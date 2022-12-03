const mongoose = require('mongoose');
const Joi = require('joi');

const collaboratorSchema = new mongoose.Schema({
	document_id: {
		type: String,
		required: true,
		min: 0,
		max: 10,
		trim: true,
	},
  	users: {
		type: Array,
		required: false,
		trim: true,
	},
	doc_type: {
		type: String,
		enum: ["Document", "Version"],
		required: false,
		trim: true,
	},
});

const Collaborator = mongoose.model('Collaborator', collaboratorSchema);

function validateCollaborator(collaborator) {
  const schema = Joi.object({
    document_id: Joi.string().min(1).max(100).required(),
    users: Joi.array().min(0).max(10).optional(),
	users: Joi.string().optional(),
  });

  return schema.validate(collaborator);
}

exports.Collaborator = Collaborator;
exports.validate = validateCollaborator;
