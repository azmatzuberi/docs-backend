const express = require('express')
const { Doc_Version, validate } = require('../models/doc_version')
const { Document } = require('../models/document')
const router = express.Router()
const auth = require('../middleware/auth')
const xssFilters = require('xss-filters')
const axios = require('axios')
const fileTypeFromFile = require('file-type')
const rateLimit = require("express-rate-limit")
const { createVersionId } = require('../certification/nanoid')
const multer = require('multer')
const { addDetailing } = require('../certification/add_stamp')
const getIp = require("../middleware/get-ip")
const geoip = require('geoip-lite')
const conversionTypes = require('../utilities/conversionArray')
const FormData = require('form-data')
const fs = require('fs')
const requestIp = require('request-ip')

let documentPath = ''

const fileUploadStorage = multer.diskStorage({
	destination: function (req, file, callback) {
	  callback(null, './uploads');
	},
	filename: function (req, file, callback) {
		documentPath = file.fieldname + '-' + Date.now() + '-' + file.originalname
	  callback(null, documentPath);
	}
});
const upload = multer({ storage : fileUploadStorage }).single('documents');

// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');
// Creates a client
const storage = new Storage();

// Sub routes
// router.use('/api-create', apiCreate);
router.use(express.json());

// Rate limiters
const versionGetLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;	
	}
});

const createVersionLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});

// Get all Versions
router.get('/', (versionGetLimiter, auth), async (req, res) => {
  const versions = await Doc_Version.find({ active: true });
  res.send(versions);
});


// Get Versions by Document id
router.post('/versions/:id', (createVersionLimiter, auth), async (req, res) => {
	if (req.user.id === req.body.user_id) {
		const versions = await Doc_Version.find({ source_doc: req.params.id, active: true });
		if (versions.length < 1) return res.status(404).send('No versions found');
		res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL)
		res.status(200).send(versions);
	} else {
		return res.status(401).send({ status: 401, message: "Unauthorized download"})
	}
});

// Create Version
router.post('/createVersion', (versionGetLimiter, upload), auth, async (req, res) => {

	let fileNameWithoutExt = ''
	let convertedFilePath = ''
	let destFileName = ''
	const clientIp = requestIp.getClientIp(req); 
	
	try {
		// Check user id
		if (req.user.id === req.body.user_id) {

		// Search for source document
		const document = await Document.findById(req.body.source_doc)
		req.body.category = document.category
		req.body.tags = document.tags

		// The path to your file to upload
		const filePath = `uploads/${documentPath}`
		const fileName = req.file.filename		
		const typeOfFile = await fileTypeFromFile.fromFile(filePath)
		console.log(typeOfFile)

		if (conversionTypes.conversionArray.includes(typeOfFile.ext)) {
			const formData = new FormData()
			formData.append('files=@', fs.createReadStream(filePath))

			const request_config = {
				responseType: 'arraybuffer',
				responseEncoding: "binary",
				headers: {
				  ...formData.getHeaders()
				},
			};
			fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "")
			const response = await axios.post('https://gotenberg.docical.com/forms/libreoffice/convert',
			formData, request_config)
			fs.writeFileSync(`gotenbergSaved/${fileNameWithoutExt}.pdf`, response.data, 'binary');

			// The new ID for your GCS file
			destFileName = req.user.email + '/' + encodeURIComponent(documentPath)

			async function uploadOriginalFile() {
				await storage.bucket('docical-original-files').upload(filePath, {
					destination: destFileName,
				});
			
				console.log(`1.${filePath} uploaded to docical-original-files`)
			}
			
			uploadOriginalFile().catch(console.error);

			async function uploadConvertedFile() {
				await storage.bucket('docical-versions').upload(`gotenbergSaved/${fileNameWithoutExt}.pdf`, {
					destination: destFileName,
				});
			
				console.log(`1b.${filePath} uploaded to docical-versions`)
			}

			uploadConvertedFile().catch(console.error);

			convertedFilePath = `gotenbergSaved/${fileNameWithoutExt}.pdf`

		} else if (typeOfFile.ext === 'pdf') {
			async function uploadOriginalFile() {
				await storage.bucket('docical-original-files').upload(filePath, {
					destination: destFileName,
				});
			
				console.log(`1.${filePath} uploaded to docical-original-files`)
			}
			const fileName = req.file.filename
			fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "")
			convertedFilePath = `uploads/${fileNameWithoutExt}.pdf`	
		} else {
				return res.status(400).send({ status: 400, message: 'Invalid file type' })
			}
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized upload"})
		}
		console.log("REQ IP", clientIp)
		const geo = geoip.lookup(clientIp)
		console.log("Geo", geo)
		req.body.created = new Date()
		req.body.size = req.file.size
		const { error } = validate(req.body)
		if (error) {
			const sanitizedError = xssFilters.inHTMLData(error.details[0].message);
			return res.status(400).send(sanitizedError);
		} 	

		const newVersion = await new Doc_Version(req.body)
		const versionIdParameters = await createVersionId(newVersion.id)
		newVersion.documentCode = versionIdParameters[0]
		newVersion.pageUrl = versionIdParameters[1]
		newVersion.documentQRCode = versionIdParameters[2]
		await addDetailing(
			convertedFilePath, 
			versionIdParameters[2], 
			newVersion.id, 
			clientIp,
			geo.city,
			geo.country,
			geo.region,
			geo.timezone,
			newVersion.pageUrl,
			req.user.email, 
			async function(securedFileUrl) {
				newVersion.securedFileUrl = securedFileUrl
				newVersion.originalFileUrl = 'https://storage.cloud.google.com/docical-versions/' +  destFileName
				newVersion.active = true
				await newVersion.save()
				res.status(200).send({ status: 200, message: 'Document created' })
			}
		)
	} catch (error) {
		console.log(error)
	}
});

// Get remote file
router.post('/remoteFile/:id', (versionGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.body.user_id) {
			const storage = new Storage();
			const bucket = storage.bucket('docical-versions')

			const document = await Doc_Version.findById(req.params.id)
			if (!document) return res.status(404).send("Document not found")

			const remoteFileUrl = document.securedFileUrl
			console.log("Remote", remoteFileUrl)
			const fileName = remoteFileUrl.replace('https://storage.cloud.google.com/docical-versions/', '')
			const googleUtilFileName = decodeURIComponent(fileName)
			const localFileName = `downloaded/${fileName}`
			let downloadedFile;
			async function downloadFile() {
				const options = {
					destination: localFileName,
				};
				
				// Downloads the file to the destination file path
				downloadedFile = await bucket.file(googleUtilFileName).download(options);
				
				console.log(
					`gs://${bucket}/${fileName} downloaded to ${localFileName}.`
				);
			}
			
			downloadFile()
			.then(() => {
				res.setHeader('Content-Disposition', 'filename=' + fileName)
				res.setHeader('Content-type', 'application/pdf')
				res.status(200).sendFile(localFileName, { root: '.'})
			}).catch((error) => {	
				console.log(error)
				return res.status(404).send({ status: 404, message: 'No file found'})
			})
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
})

// Get Version
router.post('/version/:id',(versionGetLimiter, auth), async (req, res) => {	
	let document = {}
	const version = await Doc_Version.findById(req.params.id)

	if (version) {
		document = await Document.findById(version.source_doc)
	}
	try {
		// Check user id
		if (req.user.id === version.user_id 
			|| document.user_id === req.user.id
			|| version.collaborators.includes(req.user.email) 
			|| document.collaborators.includes(req.user.email)) {
			if (!version) return res.status(404).send("Document not found")
			res.status(200).send({ message: 'Got version', data: version })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
});

// Get Shared with Me
router.post('/getSharedWithMe/:id', (versionGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.params.id) {
			const documentVersions = await Doc_Version.find({ collaborators: req.user.email })

			if ((documentVersions).length < 1) return res.status(404).send({ status: 404, message: "No documents found" })

			return res.status(200).send({ status: 200, message: "Documents found", data: documentVersions })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
})

module.exports = router
