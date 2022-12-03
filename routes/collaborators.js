const express = require('express')
const { Document, validate } = require('../models/document')
const { Doc_Version, validateVersion } = require('../models/doc_version')
const { Email, validateEmail } = require('../models/email')
const { Email_Version, validateEmailVersion } = require('../models/email_version')
const router = express.Router()
const auth = require('../middleware/auth')
const xssFilters = require('xss-filters')
const axios = require('axios')
const rateLimit = require("express-rate-limit")
const ObjectId = require('mongoose').Types.ObjectId; 

// Sub routes
// router.use('/api-create', apiCreate);
router.use(express.json());

// Rate limiters
const collaboratorGetLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});

const collaboratorUpdateLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 500,
	function(req) {

		// Check user JWT
		const token = req.header('api-x-auth-token');
		return token;
	}
});


// Update collaborators
router.put('/updateCollaborators', collaboratorUpdateLimiter, auth, async (req, res) => {
	if (req.body.user_id === req.user.id) {
		if (req.doc_type === 'Document') {
			await Document.findOneAndUpdate({ _id: req.body.id }, { collaborators: req.body.collaborators })
		} else {
			await Doc_Version.findOneAndUpdate({ _id: req.body.id }, { collaborators: req.body.collaborators })
		}
	} else {
		return res.status(401).send({ status: 401, message: 'Unauthorized access' })
	}
})

// Check Collaborators
router.post('/:id', collaboratorGetLimiter, auth, async (req, res) => {
	let result = []
	let documentCollaborator = []
	
	try {
		if (req.body.doc_type === "Document") {
			result = await Document.find({ _id: ObjectId(req.params.id), active: true })
		} else if (req.body.doc_type === "Version") {
			result =  await Doc_Version.find({ _id: ObjectId(req.params.id), active: true })
			documentCollaborator = await Document.find({ _id: ObjectId(result[0].source_doc), active: true })
		} else if (req.body.doc_type === "Email") {
			result = await Email.find({ _id: ObjectId(req.params.id), active: true })
		} else if (req.body.doc_type === "Email_Version") {
			result = await Email_Version.find({ _id: ObjectId(req.params.id), active: true })
			documentCollaborator = await Email.find({ _id: ObjectId(result[0].source_email), active: true })
		}
		
		if (documentCollaborator.length > 0 && documentCollaborator[0].collaborators.includes(req.user.email)) return res.status(200).send({ status: 200, message: 'User part of collaborators', flag: true });
		if (!result.length > 0) return res.status(404).send({ status: 404, message: 'Document not found' })
		if (result[0].collaborators.includes(req.user.email)) return res.status(200).send({ status: 200, message: 'User part of collaborators', flag: true });
		else if (result[0].user_id === req.user.id || documentCollaborator[0].user_id) {
			return res.status(201).send({ status: 201, message: 'Owner of document', flag: true });
		} else {
			return res.status(404).send({ status: 404, message: 'Not part of collaborators', flag: false });
		}
	} catch (error) {
		console.log(error)
	}
});
  
module.exports = router;
