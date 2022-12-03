const express = require('express')
const { Email, validateEmail } = require('../models/email')
const { Email_Version, validateEmailVersion } = require('../models/email_version')
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
const emailGetLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;	
	}
});

const createEmailLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});

// Get all emails
router.get('/:id', (emailGetLimiter, auth), async (req, res) => {
	if (req.user.id === req.params.id) {
		const emails = await Email_Version.find({ active: true, user_id: req.params.id });

		if (emails.length < 1) return res.status(404).send('No emails found');

		res.send(emails);
	}
});


// Get Emails Version
router.post('/versions/:id', (createEmailLimiter, auth), async (req, res) => {
	if (req.user.id === req.body.user_id) {
		const emails = await Email_Version.find({ source_email: req.params.id, active: true })
		if (emails.length < 1) return res.status(404).send('No emails found')
		res.header("Access-Control-Allow-Origin",process.env.CLIENT_URL)
		res.status(200).send(emails);
	} else {
		return res.status(401).send({ status: 401, message: "Unauthorized download"})
	}
});

// Get remote file
router.post('/remoteFile/:id', (emailGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.body.user_id) {
			const storage = new Storage();
			const bucket = storage.bucket('docical-emails-secured')

			const document = await Email_Version.findById(req.params.id)
			if (!document) return res.status(404).send("Document not found")

			const remoteFileUrl = document.securedFileUrl
			console.log("Remote", remoteFileUrl)
			const fileName = remoteFileUrl.replace('https://storage.cloud.google.com/docical-emails-secured/', '')
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

// Get Email Version
router.post('/version/:id',(emailGetLimiter, auth), async (req, res) => {
	let email = {}
	const version = await Email_Version.findById(req.params.id)

	if (version) {
		email = await Email.findById(version.source_email)	
	} else {
		return res.status(404).send({ status: 404, message: "Version not found" })
	}

	try {
		// Check user id
		if (req.user.id === version.user_id 
			|| email.user_id === req.user.id
			|| version.collaborators.includes(req.user.email) 
			|| email.collaborators.includes(req.user.email)) {
			if (!version) return res.status(404).send("Email not found")
			res.status(200).send({ message: 'Got email', data: version })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
});

// Get Shared with Me
router.post('/getSharedWithMe/:id', (emailGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.params.id) {
			const emailVersions = await Email_Version.find({ collaborators: req.user.email })

			if ((emailVersions).length < 1) return res.status(404).send({ status: 404, message: "No documents found" })

			return res.status(200).send({ status: 200, message: "Email versions found", data: emailVersions })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
})

module.exports = router
