const express = require('express')
const { Document } = require('../models/document')
const { Doc_Version } = require('../models/doc_version')
const router = express.Router()
const auth = require('../middleware/auth')
const xssFilters = require('xss-filters')
const axios = require('axios')
const axiosRetry = require('axios-retry');
const createDocument = require('./createDocument/createDocument')
const rateLimit = require("express-rate-limit")
axiosRetry(axios, { retries: 3 });
// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');

// Sub routes
router.use(express.json());
router.use('/createDocument', createDocument);

// Rate limiters
const docGetLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});

// Get all Documents
router.post('/getAllDocs/:id', docGetLimiter, auth, async (req, res) => {
	
	// Check user id
	if (req.user.id === req.params.id) {
		try {
			const documents = await Document.find({ active: true, user_id: req.params.id }).select('-__v');
			for (let document in documents) {
				const results =  await Doc_Version.find({ source_doc: documents[document].id })
				documents[document].versions = results.length
			}
			if (req.body.count) {
				const results =  await Doc_Version.find({ active: true, user_id: req.params.id })
				res.status(200).send({ count: documents.length + results.length})
			} else {
				res.status(200).send(documents);
			}
		} catch (error) {
			console.log(error)
		}
	} else {
		return res.status(401).send({ status: 401, message: "Unauthorized download"})
	}	
});

// Get Document
router.post('/document/:id',(docGetLimiter, auth), async (req, res) => {	
	
	try {
		const document = await Document.findById(req.params.id)
		// Check user id
		if (req.user.id === document.user_id || document.collaborators.includes(req.user.email)) {
			if (!document) return res.status(404).send("Document not found")
			res.status(200).send({ message: 'Got document', data: document })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
})

// Get Document by collaborator
router.post('/getSharedWithMe/:id',(docGetLimiter, auth), async (req, res) => {	
	try {
		// Check user id
		if (req.user.id === req.params.id) {
			const documents = await Document.find({ collaborators: req.user.email })
			if (!documents.length > 0) return res.status(404).send("Documents not found")
			res.status(200).send({ message: 'Got documents', data: documents })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download" })
		}
	} catch (error) {
		console.log(error);
	}
})


// Get remote file
router.post('/remoteFile/:id', (docGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.body.user_id) {
			const storage = new Storage();
			const bucket = storage.bucket('docical-secured-documents')

			const document = await Document.findById(req.params.id)
			if (!document) return res.status(404).send("Document not found")

			const remoteFileUrl = document.securedFileUrl
			console.log("FEI>", remoteFileUrl)
			const fileName = remoteFileUrl.replace(`https://storage.cloud.google.com/docical-secured-documents/`, '')
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

// Get Shared with Me
router.post('/getSharedWithMe/:id', (docGetLimiter, auth), async (req, res) => {
	try {

		// Check user id
		if (req.user.id === req.params.id) {
			const documents = await Document.find({ collaborators: req.user.email })

			if ((documents).length < 1) return res.status(404).send({ status: 404, message: "No documents found" })

			return res.status(200).send({ status: 200, message: "Documents found" })
		} else {
			return res.status(401).send({ status: 401, message: "Unauthorized download"})
		}
	} catch (error) {
		console.log(error);
	}
})
  
module.exports = router;
