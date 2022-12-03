const mongoose = require('mongoose');
const Joi = require('joi');

const versionSchema = new mongoose.Schema({
	first_name: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 100,
		trim: true,
	},
	last_name: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 100,
		trim: true,
	},
	name: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 100,
		trim: true,
	},
  	owner: {
		type: String,
		required: false,
		minlength: 2,
		maxlength: 50,
		trim: true,
	},
  	size: {
		type: Number,
		required: true,
		min: 1,
		max: 10000000,
		trim: true,
	},
	category: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 50
	},
	tags: {
		type: Array,
		required: true,
		min: 1,
		max: 5
	},
  	collaborators: {
		type: Array,
		required: false,
		minlength: 0,
		maxlength: 10,
		trim: true,
		},
	company: {
		type: String,
		required: false,
		minlength: 1,
		maxlength: 100,
	},
	image: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 400,
	},
	created: {
		type: Date,
    	required: true
	},
	lastAccessed: {
		type: Date,
    	required: false
	},
	versionCode: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 400,
	},
	versionQRCode: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 400,
	},
	securedFileUrl: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 2000
	},
	originalFileUrl: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 2000
	},
	pageUrl: {
		type: String,
		required: false,
		minlength: 8,
		maxlength: 2000
	},
	description: {
		type: String,
		required: false,
		minlength: 0,
		maxlength: 350
	},
	source_doc: {
		type: String,
		required: true,
		minlength: 10,
		maxlength: 50
	},
	ip: {
		type: String,
		required: false,
		minlength: 0,
		maxlength: 50
	},
	user_id: {
		type: String,
		required: true,
		minlength: 5,
		maxlength: 50
	},
	active: {
		type: Boolean,
		required: false
	},
	docType: {
		type: String,
		enum: ["Document", "Version"],
		required: false
	},
	thumbnail: {
		type: String,
		required: false
	}
});

const Doc_Version = mongoose.model('Doc_Version', versionSchema);

function validateVersion(doc_version) {
  const schema = Joi.object({
    first_name: Joi.string().min(1).max(100).required(),
	last_name: Joi.string().min(1).max(100).required(),
	name: Joi.string().min(1).max(100).required(),
    owner: Joi.string().min(2).max(50).optional(),
    size: Joi.number().min(1).max(10000000).required(),
	category: Joi.string().min(1).max(50).required(),
	tags: Joi.array().min(1).max(5).optional(),
    collaborators: Joi.array().min(0).max(10).optional(),
	image: Joi.string().min(8).max(400).optional(),
	company: Joi.string().min(1).max(100).optional(),
	created: Joi.date().required(),
	lastAccessed: Joi.date().optional(),
	versionCode: Joi.string().min(8).max(400).optional(),
	versionQRCode: Joi.string().min(8).max(400).optional(),
	securedFileUrl: Joi.string().min(8).max(2000).optional(),
	originalFileUrl: Joi.string().min(8).max(2000).optional(),
	pageUrl: Joi.string().min(8).max(2000).optional(),
	description: Joi.string().min(0).max(350).optional(),
	source_doc: Joi.string().min(10).max(50).required(),
	ip: Joi.string().min(0).max(50).optional(),
	user_id: Joi.string().min(5).max(50).optional(),
	active: Joi.boolean().optional(),
	docType: Joi.string().optional(),
	thumbnail: Joi.string().optional()
});

  return schema.validate(doc_version);
}

exports.Doc_Version = Doc_Version;
exports.validateVersion = validateVersion;
