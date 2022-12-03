const _ = require('lodash');
const { User, validate } = require('../models/user');
const { Token } = require('../models/token');
const dbDebugger = require('debug')('app:db');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth')
const tldts = require('tldts');
const xssFilters = require('xss-filters');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const passwordComplexity = require("joi-password-complexity");
const bcrypt = require('bcrypt');
const saltRounds = 10;

router.use(express.json());

// Mailer
const send = require('gmail-send')({
	user: 'azmatzuberi@gmail.com',
	from: 'azmat@docical.com',
	pass: process.env.GOOGLE_SEND,
	to:   'azmat@docical.com'
});

router.post('/', async (req, res) => {
	try {
		const { error } = validate(req.body)
		if (error) {
			const sanitizedError = xssFilters.inHTMLData(error.details[0].message);
			return res.status(400).send(sanitizedError);
		} 

		// If user exists already
		let user = await User.findOne({	email: req.body.email })
		if (user) {

			// Check password
			bcrypt.compare(req.body.password, user.password, async function(err, result) {
				if (result === true) {
					// Send notification email
					send({ 
						subject: `User logged in - ${user.email} - ${process.env.CLIENT_DOMAIN}`,         
					}, function (err, res, full) {
						if (err) return console.log('* [example 1.1] send() callback returned: err:', err)
						console.log('* [example 1.1] send() callback returned: res:', res)
					});

					// Access token and refresh token
					const access_token = user.generateAuthToken()
					const refresh_token = user.generateRefreshToken()
					res.header("api-x-auth-token", access_token)
					res.header("api-x-refresh-token", refresh_token)

					// Refresh token saved
					const tokenSaveInDB = {
						refresh_token,
						created: new Date(),
						user_id: user.id
					}

					const refreshTokenSaved = await new Token(tokenSaveInDB)
					await refreshTokenSaved.save()

					user.last_accessed = new Date()
					await user.save()
					return res.status(200).send({ user: _.pick(user, ['_id', 'first_name', 'last_name', 'email', 'company_name', 'customer.id']), access_token, refresh_token  })
				} else {
					return res.status(401).send('Password is incorrect')
				}
			});
		} else {

			// If new user
			user = await new User(_.pick(req.body, ['first_name', 'last_name', 'email', 'password', 'company_name']))
			// user.customer = await createCustomer.createCustomer(req.body)
			const complexityOptions = {
				min: 10,
				max: 30,
				lowerCase: 1,
				upperCase: 1,
				numeric: 1,
				symbol: 0,
				requirementCount: 2,
			};
			const { error } = passwordComplexity(complexityOptions).validate(req.body.password);
			if (error) return res.status(400).send(error)
			user.created = new Date()

			// Generate token
			const access_token = user.generateAuthToken()
			const refresh_token = user.generateRefreshToken()
			res.header("api-x-auth-token", access_token)
			res.header("api-x-refresh-token", refresh_token)

			// Refresh token saved
			const tokenSaveInDB = {
				refresh_token,
				created: new Date(),
				user_id: user.id
			}

			const refreshTokenSaved = await new Token(tokenSaveInDB)
			await refreshTokenSaved.save()

			// Create email verify token for email
			const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
			let emailToken = '';
			for (let i = 0; i < 25; i++) {
				emailToken += characters[Math.floor(Math.random() * characters.length )]
			}
			user.email_token = emailToken

			// Hash password
			bcrypt.genSalt(saltRounds, function(err, salt) {
				bcrypt.hash(req.body.password, salt, async function(err, hash) {
					// Save user
					user.password = hash
					user.active = false
					const savedUser = await user.save()
					console.log("Save", savedUser)
				});
			});

			// Send notification email
			send({ 
				subject: `New user signed up - ${user.email} - ${process.env.CLIENT_DOMAIN}`,         
			}, function (err, res, full) {
				if (err) return console.log('* [example 1.1] send() callback returned: err:', err)
				console.log('* [example 1.1] send() callback returned: res:', res)
			});

			// Email template
			const sendVerify = require('gmail-send')({
				user: 'azmatzuberi@gmail.com',
				pass: process.env.GOOGLE_SEND,
				from: 'azmat@docical.com',
				to:   user.email,
				html: 
				`<!DOCTYPE html>
					<html>
						<head>
					
						</head>
						<body>
							<h1>Welcome to Docical</h1>
							<h2>Your way to protect against forgery and prove the authenticity of your documents</h2>
							<a href="${process.env.BACKEND_DOMAIN}/email-verify?${user.email}&${emailToken}">
								<button>Click here to verify your address</button>
							</a>
						</body>
					</html>
				`	
			});

			// Send email
			// sendVerify({ 
			// 	subject: `New user sign up - ${user.email} - ${process.env.CLIENT_DOMAIN}`,         
			// 	}, function (err, res, full) {
			// 	if (err) return console.log('* [example 1.1] send() callback returned: err:', err)
			// 	console.log('* [example 1.1] send() callback returned: res:', res)
			// })

			// Send user back to client
			res.status(200).send({ user: _.pick(user, ['_id', 'first_name', 'last_name', 'email', 'company_name', 'customer.id']), access_token, refresh_token })
		}
	}	catch (error) {
		dbDebugger(error)
	}
})

// Get user info
router.get('/user', auth, async (req, res) => {
	try {
		const user = await User.findOne({ email: req.user.email })
		if (!user) return res.status(404).send('No user data found')

		res.status(200).send({ user: _.pick(user, ['_id', 'first_name', 'last_name', 'company_name', 'customer.id', 'email']) })
	} catch (error) {
		console.log(error)
	}
})

// Get refresh access token
router.post('/refresh', async (req, res) => {
	try {
		const refresh_token = req.body.refresh_token

		// If token is not provided, send error message
		if (!refresh_token) {
			res.status(401).send("Refresh token not found")
		}

		const decodedRefreshToken = jwt.verify(refresh_token, process.env.JWT_REFRESH_KEY);
		req.user = decodedRefreshToken;

		const lastRefreshTokens = await Token.find({ user_id: req.user.id }).limit(1).sort({$natural:-1})
		if (!lastRefreshTokens.refresh_token == refresh_token) return res.status(404).send('No valid refresh token')

		const user = await User.findById(req.user.id)
		const access_token = user.generateAuthToken()

		return res.status(200).send({ access_token })
	} catch (error) {
		console.log(error)
		res.status(403).send({
			errors: [
				{
					msg: "Invalid token",
				},
			],
		});
	}
})

// Logout user
router.delete("/logout", auth, async (req, res) => {
	const refreshToken = req.header("Authorization");
  
	const refreshTokenFromDB = await Token.deleteOne({ token: refreshToken })
	res.status(204).send('User logged out');
});

module.exports = router;
