const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const fs = require("fs")
const fontkit = require('@pdf-lib/fontkit')
const download = require('image-downloader')

// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage')
// Creates a client
const storage = new Storage()
let securedFileUrl = '' 

async function addDetailing(
	first_name,
	last_name,
	user_id,
	docType,
	convertedFilePath, 
	qrCode, 
	documentId, 
	ip,
	pageUrl,
	userEmail, 
	fn) {
			const options = {
				url: 'https://storage.googleapis.com/docical-images/Symbol.png',
				dest: '../../images/Symbol.png'
			}
		
			download.image(options)
			.then(({ filename }) => {
				console.log('Saved to', filename)

				const existingPdfBytes = fs.readFile(convertedFilePath, Uint8Array, function (err, existingPdfBytes) {
					if (err) throw err;
					const pngImageBytes = fs.readFile(qrCode, Uint8Array, async function (err, pngImageBytes) {
						if (err) throw err;
						const fontBytes = fs.readFile('fonts/Manrope-VariableFont_wght.ttf', 
							Uint8Array, async function (err, fontBytes) {
		
							// Date and time of doc
							const dateTime = new Date()
							
							const pdfDoc = await PDFDocument.load(existingPdfBytes)
							const pngImage = await pdfDoc.embedPng(pngImageBytes)	
							pdfDoc.registerFontkit(fontkit)
							const customFont = await pdfDoc.embedFont(fontBytes)
							const page = pdfDoc.addPage()
						
							const pngDims = pngImage.scale(0.25)

							page.setHeight(792)
							page.setWidth(612)
			
							page.drawImage(pngImage, {
								x: page.getWidth() / 2 - pngDims.width / 2,
								y: page.getHeight() / 2 - pngDims.height / 2,
								width: pngDims.width,
								height: pngDims.height,
							})
			
							const text = 'Docical ID: ' + documentId
							const textSize = 10
							
							page.drawText(text, {
								x: page.getWidth() / 2 - pngDims.width + 35,
								y: page.getHeight() / 2 - pngDims.height / 2 + 215,
								size: textSize,
								font: customFont,
								color: rgb(0, 0, 0),
							})
							
							page.drawText('User ID: ' + user_id, {
								x: page.getWidth() / 2 - pngDims.width + 35,
								y: page.getHeight() / 2 - pngDims.height / 2 + 200,
								size: textSize,
								font: customFont,
								color: rgb(0, 0, 0),
							})
						
							page.drawText('Name: ' + first_name + ' ' + last_name, {
								x: page.getWidth() / 2 - pngDims.width + 35,
								y: page.getHeight() / 2 - pngDims.height / 2 + 185,
								size: textSize,
								font: customFont,
								color: rgb(0, 0, 0),
							})
			
							page.drawText('IP: ' + ip, {
								x: page.getWidth() / 2 - pngDims.width + 35,
								y: page.getHeight() / 2 - pngDims.height / 2 + 170,
								size: textSize,
								font: customFont,
								color: rgb(0, 0, 0),
							})
			
							// page.drawText('Region: ' + region, {
							// 	x: page.getWidth() / 2 - pngDims.width + 35,
							// 	y: page.getHeight() / 2 - pngDims.height / 2 + 155,
							// 	size: textSize,
							// 	font: customFont,
							// 	color: rgb(0, 0, 0),
							// })
			
							// page.drawText('Timezone: ' + timezone, {
							// 	x: page.getWidth() / 2 - pngDims.width + 35,
							// 	y: page.getHeight() / 2 - pngDims.height / 2 + 140,
							// 	size: textSize,
							// 	font: customFont,
							// 	color: rgb(0, 0, 0),
							// })
			
							page.drawText(pageUrl, {
								x: page.getWidth() / 2 - pngDims.width - 10,
								y: page.getHeight() / 2 - pngDims.height / 2 - 50,
								size: textSize,
								font: customFont,
								color: rgb(0, .24, 1),
							})
			
							page.drawText(dateTime.toString(), {
								x: page.getWidth() / 2 - pngDims.width / 2 - 72.5,
								y: page.getHeight() / 2 - pngDims.height / 2 - 35,
								size: textSize,
								font: customFont,
								color: rgb(0, 0, 0),
							})
			
							page.drawText('Document record', {
								x: page.getWidth() / 2 - 60,
								y: page.getHeight() / 2 - pngDims.height / 2 + 250,
								size: 20,
								font: customFont,
								color: rgb(0, 0, 0),
							})
						
							page.drawRectangle({
								x: 10,
								y: 0,
								width: 20,
								height: 2000,
								borderColor: rgb(0.1, 0.45, 0.91),
								borderWidth: 1.5,
								color: rgb(0.1, 0.45, 0.91),
							})
			
							const stamp = fs.readFile('images/Symbol.png', Uint8Array, async function (err, stamp) {
								const stampImage = await pdfDoc.embedPng(stamp)
								const stampDims = stampImage.scale(0.10)
			
								page.drawImage(stampImage, {
									x: page.getWidth() / 2 - stampDims.width / 2,
									y: page.getHeight() / 2 - stampDims.height / 2 + 300,
									width: stampDims.width,
									height: stampDims.height,
								})
			
								// Save the PDF file and get the data to save below  
								const pdfBytes = await pdfDoc.save()
								const data = new Uint8Array(pdfBytes);
			
								// Removing extra strings from converted file path
								convertedFilePath = convertedFilePath.replace('uploads/', '-')
								convertedFilePath = convertedFilePath.replace('gotenbergSaved/', '')
								
								// Formatting of file path
								const filePathRaw = `securedDocuments/${dateTime}-${convertedFilePath}`
								const filePath = filePathRaw.replace(/\s+/g, '-')
			
								// filePath is path to which the file will be created
								fs.writeFileSync(filePath, data, (err) => {
									if (err) throw err;
									console.log('3.The file has been saved!')
								})
			
								// Bucket name for Google Storage
								const bucketName = docType ===  'Document' ? 'docical-secured-documents' : docType === 'Version' ? 'docical-versions' : 'docical-emails-secured'
			
								// The new ID for your GCS file
								const destFileName = filePath.replace('securedDocuments', userEmail)
			
								async function uploadFile() {
									await storage.bucket(bucketName).upload(filePath, {
										destination: destFileName,
									});
						
									console.log(`4.${destFileName} uploaded to ${bucketName}`)
								}
			
								uploadFile().catch(console.error);
			
								fn(securedFileUrl = `https://storage.cloud.google.com/${docType === 'Document' ? 'docical-secured-documents' : docType === 'Version' ? 'docical-versions' : 'docical-emails-secured'}/${encodeURIComponent(destFileName)}`) 
					}) 
				})
			})
		})
	}).catch((err) => console.error(err))
}



exports.addDetailing = addDetailing
