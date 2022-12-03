//getBodyContent.js
/**
 * Get the recent email from your Gmail account
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

 'use strict'

 const fs = require('fs')
 const {promisify} = require('util')
 const {google} = require('googleapis')
 const {OAuth2Client} = require('google-auth-library')
 const gmail = google.gmail('v1');
 const { Email, validateEmail } = require('../models/email')
 const { User, validate } = require('../models/user')
 const { convertEmail2Pdf } = require('../certification/email2pdf')
 const { createEmailId } = require('../certification/nanoid')
 const pdf2base64 = require('pdf-to-base64')
 const { PDFDocument } = require('pdf-lib')
 const base64url = require('base64url');
 
 // Promisify with promise
 const readFileAsync = promisify(fs.readFile);
 const gmailGetMessagesAsync = promisify(gmail.users.messages.get);
 const gmailListMessagesAsync = promisify(gmail.users.messages.list);
 const gmailMarkAsRead = promisify(gmail.users.messages.modify);
 const gmailGetAttachments = promisify(gmail.users.messages.attachments.get);
 
 const TOKEN_DIR = __dirname;
 const TOKEN_PATH = TOKEN_DIR + '/gmail-nodejs-quickstart.json';
 
 const main = async () => {
	 // Get credential information  & specify the client secret file
	 const content = await readFileAsync('keys/client_secret.json'); 
	 const credentials = JSON.parse(content); // credential
 
	 // authentication
	 const clientSecret = credentials.web.client_secret;
	 const clientId = credentials.web.client_id;
	 const redirectUrl = credentials.web.redirect_uris[0];
	 const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
	 const token = await readFileAsync(TOKEN_PATH);
	 oauth2Client.credentials = JSON.parse(token);

	// Access the gmail via API
	const res = await gmail.users.messages.list({
		auth: oauth2Client,
		userId: "me",
		maxResults: 500,
		q: "to:docs@docical.com is:unread"
	});

	if (!res.data.messages) return

	console.log("IDs:", res.data.messages)
	const newestMessageId = []
	const response = []
	// Get the message id which we will need to retreive tha actual message next.
	for (let i = 0; i < res.data.messages.length; i++) {
		newestMessageId[i] = res["data"]["messages"][i]["id"];

		// Retreive the actual message using the message id
		response[i] = await gmail.users.messages.get({
			auth: oauth2Client,
			userId: "me",
			id: newestMessageId[i],
			format: "full"
		});

		console.log("Responseeee", response[i].data.payload.parts[1].body)
	}

	let buff, htmlBuff, mailBody, htmlMailBody, userEmail, emailSubject, date, originIp, to, cc, bcc, attachmentId;
	let attachments = []

	for (let newMessages = 0; newMessages < response.length; newMessages++) {
		for (let i = 0; i < response[newMessages].data.payload.headers.length; i++) {
			if (response[newMessages].data.payload.headers[i].name === 'From') {
				userEmail = response[newMessages].data.payload.headers[i].value
			}
			if (response[newMessages].data.payload.headers[i].name === 'Subject') {
				emailSubject = response[newMessages].data.payload.headers[i].value
			}
			if (response[newMessages].data.payload.headers[i].name === 'Date') {
				date = response[newMessages].data.payload.headers[i].value
			}
			if (response[newMessages].data.payload.headers[i].name === 'To') {
				to = response[newMessages].data.payload.headers[i].value
			}
			if (response[newMessages].data.payload.headers[i].name === 'Cc') {
				cc = response[newMessages].data.payload.headers[i].value
			}
			if (response[newMessages].data.payload.headers[i].name === 'Bcc') {
				bcc = response[newMessages].data.payload.headers[i].value
			}
		}
		if (response[newMessages].data.payload.parts[0].body.data) {
			mailBody = response[newMessages].data.payload.parts[0].body.data
		} else {
			mailBody = response[newMessages].data.payload.parts[0].parts[0].body.data
		}
		if (response[newMessages].data.payload.parts[1].body.data) {
			htmlMailBody = response[newMessages].data.payload.parts[1].body.data
		}  else {
			htmlMailBody = response[newMessages].data.payload.parts[0].parts[0].body.data
			if (response[newMessages].data.payload.parts[1].body.attachmentId) {
				attachmentId = response[newMessages].data.payload.parts[1].body.attachmentId
				const attachment = await gmail.users.messages.attachments.get({
					auth: oauth2Client,
					userId: "me",
					messageId: newestMessageId[newMessages],
					id: attachmentId
				});
				console.log("Get attachment", attachment)
				attachments.push(attachment)
			}
		}

		const data = JSON.stringify(mailBody)
		const htmlData = JSON.stringify(htmlMailBody)
		buff = new Buffer.from(data, "base64")
		htmlBuff = new Buffer.from(htmlData, "base64")
		const attachmentsBuff = attachments[0] ? base64url.toBase64(attachments[0].data.data) : null
		mailBody = buff.toString()
		htmlMailBody = htmlBuff.toString()
		const userName = userEmail.substring(userEmail.lastIndexOf(''), userEmail.lastIndexOf('<'))
		userEmail = userEmail.substring(userEmail.lastIndexOf('<') + 1, userEmail.lastIndexOf('>'))
		console.log("Name", userName)
		console.log("userEmail", userEmail)
		console.log("date", date)
		console.log("SubjectBody", emailSubject)
		// console.log("HTMLMAILBODY", htmlMailBody)
		// console.log("MAILBODY", mailBody)
		console.log("")

		const user = await User.findOne({ email: userEmail })
		
		if (!user) continue;

		const emailObject = { 
			user_id: user._id, 
			name: emailSubject,
			first_name: user.first_name,
			last_name: user.last_name,
			email: user.email,
			owner: user._id,
			category: '',
			tags: '',
			created: new Date(),
			emailDate: date,
			email_content: mailBody,
			html_content: htmlMailBody
		}
		const email = new Email(emailObject)
		const emailIdParameters = await createEmailId(email.id)
		email.documentCode = emailIdParameters[0]
		email.pageUrl = emailIdParameters[1]
		email.documentQRCode = emailIdParameters[2]
		email.pageUrl = `${process.env.CLIENT_URL}/${email.id}`
		convertEmail2Pdf(
			user.first_name,
			user.last_name,
			user._id,
			"Email",
			email.documentQRCode,
			email.name,
			mailBody, 
			userEmail,
			date,
			email.id,
			email.pageUrl,
			emailObject,
			attachmentsBuff,
			async function(pdfFileDetails) {
				email.originalFileUrl = pdfFileDetails[0],
				email.securedFileUrl = pdfFileDetails[2]
				email.active = true

				fs.readFile(pdfFileDetails[1], Uint8Array, async function (err, existingPdfBytes) {
					if (err) throw err;
					const pdfDocumenCreated = await PDFDocument.load(existingPdfBytes)
					const pdfDoc = await PDFDocument.create();
  					const [firstPage] = await pdfDoc.copyPages(pdfDocumenCreated, [0])
					pdfDoc.addPage(firstPage)
					const pdfBytes = await pdfDoc.save()	
					const data = new Uint8Array(pdfBytes)
					const path = 'uploads/temp' + Math.random(0, 10)
					fs.writeFileSync(path, data, (err) => {
						if (err) throw err;
						console.log('3.The file has been saved!')
					})

					pdf2base64(pdfFileDetails[1])
					.then(async (response) => {
							email.thumbnail = response
							await email.save()
							console.log("Email created")
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

		gmail.users.messages.modify({
			auth: oauth2Client,
			userId:'me',
			id: newestMessageId[newMessages],
			resource: {
				'addLabelIds':[],
				'removeLabelIds': ['UNREAD']
			}
		}).then((result) => 
			console.log("Email marked as read successfully. ")
		).catch((error) => console.log(error))
	}
};
 
// setInterval(() => {
	main();
// }, 300000)


