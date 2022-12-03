const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  	refresh_token: {
		type: String,
		required: true,
		maxlength: 500
	},
	created: {
		type: Date,
		required: true
	},
	user_id: {
		type: String,
		required: true,
		maxlength: 100
	}
});

const Token = mongoose.model('Token', tokenSchema);

exports.Token = Token;
