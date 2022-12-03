const express = require('express')
const { Document, validate } = require('../../models/document')
const { Doc_Version, validateVersion } = require('../../models/doc_version')
const { Email, validateEmail } = require('../../models/email')
const { Email_Version, validateEmailVersion } = require('../../models/email_version')
const { PDFDocument } = require('pdf-lib')
const router = express.Router()
const auth = require('../../middleware/auth')
const xssFilters = require('xss-filters')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const fileTypeFromFile = require('file-type')
const rateLimit = require("express-rate-limit")
const { createDocumentId } = require('../../certification/nanoid')
const { createVersionId } = require('../../certification/nanoid')
const multer = require('multer')
const { addDetailing } = require('../../certification/add_stamp')
const getIp = require("../../middleware/get-ip")
const geoip = require('geoip-lite')
const requestIp = require('request-ip')
const conversionTypes = require('../../utilities/conversionArray')
const FormData = require('form-data')
const fs = require('fs')
const pdf2base64 = require('pdf-to-base64')
const axiosRetry = require('axios-retry')
axiosRetry(axios, { retries: 3 })

// Rate limiters
const docCreateLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});

let documentPath = ''
let fileNameWithoutExt = ''
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

// Create Document
router.post('/', (docCreateLimiter, upload), auth, async (req, res) => {

	let fileNameWithoutExt = ''
	let convertedFilePath = ''
	let destFileName = ''
	let destImageFileName = ''
	const docType = req.body.docType
	const clientIp = requestIp.getClientIp(req);

	console.log(req.user.id)
	
	try {
		// Check user id
		if (req.user.id === req.body.user_id) {

			// Search for source document
			if (docType === 'Version') {
				const source_document = await Document.findById(req.body.source_doc)
				req.body.category = source_document.category
				req.body.tags = source_document.tags
			} else if (docType === 'Email_Version') {
				const source_document = await Email.findById(req.body.source_email)
			}

			// The path to your file to upload
			const filePath = `uploads/${documentPath}`
			const fileName = req.file.filename		
			const typeOfFile = await fileTypeFromFile.fromFile(filePath)
			console.log(typeOfFile)
			// The new ID for your GCS file
			destFileName = req.user.email + '/' + encodeURIComponent(documentPath)
			console.log(destFileName)

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
				axiosRetry(axios, { retries: 3, retryDelay: (retryCount) => {
					return retryCount * 1000;
				}});
				const response = await axios.post('https://gotenberg.docical.com/forms/libreoffice/convert',
				formData, request_config)
				fs.writeFileSync(`gotenbergSaved/${fileNameWithoutExt}.pdf`, response.data, 'binary');

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

				uploadOriginalFile().catch(console.error);

				const fileName = req.file.filename
				fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "")
				convertedFilePath = `uploads/${fileNameWithoutExt}.pdf`	
			} else {
					return res.status(400).send({ status: 400, message: 'Invalid file type' })
			}
			console.log("REQ IP", clientIp)
			const geo = geoip.lookup(clientIp)
			console.log("Geo", geo)
			req.body.created = new Date()
			if (docType === "Document" || docType === "Version") req.body.size = req.file.size
			let error = {}
			if (docType === "Document") { error  = validate(req.body) }
			else if (docType === "Version") { error = validateVersion(req.body) }
			else { error = validateEmailVersion(req.body) }

			if (error.error) {
				const sanitizedError = xssFilters.inHTMLData(error.error.details[0].message);
				return res.status(400).send(sanitizedError);
			}

			let versionIdParameters = ''
			let newDocument = {}
			if (docType === 'Document') {
				newDocument = await new Document(req.body)
				versionIdParameters = await createDocumentId(newDocument.id)
			} else if (docType === 'Version') {
				newDocument = await new Doc_Version(req.body)
				versionIdParameters = await createVersionId(newDocument.id)
			} else {
				newDocument = await new Email_Version(req.body)
				versionIdParameters = await createVersionId(newDocument.id)
			}
			const user_id = req.body.user_id
			const first_name = req.body.first_name
			const last_name = req.body.last_name
			newDocument.first_name = first_name
			newDocument.last_name = last_name
			newDocument.documentCode = versionIdParameters[0]
			newDocument.pageUrl = versionIdParameters[1]
			newDocument.documentQRCode = versionIdParameters[2]
			await addDetailing(
				first_name,
				last_name,
				user_id,
				docType,
				convertedFilePath, 
				versionIdParameters[2], 
				newDocument.id, 
				clientIp,
				newDocument.pageUrl,
				req.user.email, 
				async function(securedFileUrl) {
					newDocument.securedFileUrl = securedFileUrl
					newDocument.originalFileUrl = 'https://storage.cloud.google.com/docical-original-files/' + decodeURIComponent(destFileName)
					newDocument.active = true
					fs.readFile(convertedFilePath, Uint8Array, async function (err, existingPdfBytes) {
						if (err) throw err;
				
						const pdfDoc = await PDFDocument.load(existingPdfBytes)
						let totalPages = pdfDoc.getPageCount()
						totalPages--
						if (totalPages > 1) {
							for (let i = 0; i < totalPages; i++ ) {
								pdfDoc.removePage(1) 
							}
						}

						const pdfBytes = await pdfDoc.save()	
						
						let pdf2pngArray = ''
						pdf2base64(convertedFilePath)
						.then(
							async (response) => {
								pdf2pngArray = response
								newDocument.thumbnail = pdf2pngArray
								await newDocument.save()
								res.status(200).send({ status: 200, message: 'Document created' })
							}
						)
						.catch(
							(error) => {
								console.log(error);
							}
						)
					})
				}
			)
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized upload"})
		}
	} catch (error) {
		console.log(error)
	}
});

module.exports = router
