const mongoose = require('mongoose');
const Joi = require('joi');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  	first_name: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 50,
		trim: true,
  	},
	last_name: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 50,
		trim: true,
  	},
	email: {
		type: String,
		required: true,
		minlength: 1,
		maxlength: 255,
		dropDups: true,
		unique: true,
		trim: true,
  	},
	profile_image: {
		type: String,
		required: false,
		maxlength: 255,
		trim: true,
	},
	customer: {
		type: Object
	},
	company_name: {
		type: String,
		required: false,
		minlength: 0,
		maxlength: 100,
	},
	created: {
		type: Date,
    	required: false
	},
	last_accessed: {
		type: Date,
    	required: false
	},
	password: {
		type: String,
		required: true,
		minlength: 10,
		maxlength: 100
	},
	active: {
		type: Boolean,
		required: false
	},
	email_token: {
		type: String,
		required: false
	}
});

userSchema.methods.generateAuthToken = function () {
	const options = {
		expiresIn: '10min',
		issuer: process.env.ISSUER
	};
  	const token = jwt.sign({ 
		id: this.id,
		email: this.email,
	}, 	process.env.JWT_PRIVATE_KEY, options);
  	return token;
};

userSchema.methods.generateRefreshToken = function () {
	const options = {
		expiresIn: '7d',
		issuer: process.env.ISSUER
	};
  	const token = jwt.sign({ 
		id: this.id,
		email: this.email,
	}, 	process.env.JWT_REFRESH_KEY, options);
  	return token;
};

const User = mongoose.model('User', userSchema);

function validateUser(user) {
  const schema = Joi.object({
    first_name: Joi.string().min(1).max(50).optional(),
    last_name: Joi.string().min(1).max(50).optional(),
    email: Joi.string().min(6).max(255).required(),
    profile_image: Joi.string().min(6).max(255).optional(),
    password: Joi.string().min(1).max(100).required(),
    customer: Joi.array().optional(),
	company_name: Joi.string().min(0).max(100).optional(),
	created: Joi.date().optional(),
	last_accessed: Joi.date().optional(),
	active: Joi.boolean().optional(),
	email_token: Joi.string().optional()
  });

  return schema.validate(user);
}

exports.User = User;
exports.validate = validateUser;
