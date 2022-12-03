const { PDFDocument, rgb 	} = require('pdf-lib')
const fs = require("fs")
const fontkit = require('@pdf-lib/fontkit')
const download = require('image-downloader')
const addStamp = require('./add_stamp')

// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage')
// Creates a client
const storage = new Storage() 

async function convertEmail2Pdf(
	first_name,
	last_name,
	user_id,
	docType,
	qrCode,
	emailSubject,
	emailText,
	userEmail,
	date,
	email_id,
	page_url,
	emailObject,
	attachmentsBuff,
	fn) {
			const options = {
				url: 'https://storage.googleapis.com/docical-images/Symbol.png',
				dest: '../../images/Symbol.png'
			}
			download.image(options)
			.then(({ filename }) => {
				console.log('Saved to', filename)
				async function createPdf() {
					const fontBytes = fs.readFile('fonts/Manrope-VariableFont_wght.ttf', 
						Uint8Array, async function (err, fontBytes) {
						const pdfDoc = await PDFDocument.create()				
						pdfDoc.registerFontkit(fontkit)
						const customFont = await pdfDoc.embedFont(fontBytes)
						const page = pdfDoc.addPage()
						page.setHeight(792)
						page.setWidth(612)
		
						page.drawText('Docical Email record', {
							x: page.getWidth() / 2 - 55,
							y: page.getHeight() / 2 + 360,
							size: 20,
							font: customFont,
							color: rgb(0, 0, 0),
						})

						page.drawText('From: ' + first_name + ' ' + last_name, {
							x: 35,
							y: page.getHeight() / 2 + 345,
							size: 12,
							font: customFont,
							color: rgb(0, 0, 0),
						})

						page.drawText('Date: ' + date, {
							x: 35,
							y: page.getHeight() / 2 + 330,
							size: 12,
							font: customFont,
							color: rgb(0, 0, 0),
						})
						
						page.drawText('Subject: ' + emailSubject, {
							x: 35,
							y: page.getHeight() / 2 + 315,
							size: 12,
							font: customFont,
							color: rgb(0, 0, 0),
						})

						const numberOfPageNeeded = emailText.length / 1500
						let pages = []
						let charactersStart = 1500, charactersEnd = 1500
						if (numberOfPageNeeded > 1) {
							for (let pageNumber = 0; pageNumber < numberOfPageNeeded; pageNumber++) {
								if (pageNumber === 0) {
									const textOfPage = emailText.substring(0, 1500)
									page.drawText(textOfPage, {
										x: 35,
										y: page.getHeight() / 2 + 285,
										size: 12,
										font: customFont,
										color: rgb(0, 0, 0),
										maxWidth: 700
									})
								} else {
									pages[pageNumber] = pdfDoc.addPage()
									pages[pageNumber].setHeight(792)
									pages[pageNumber].setWidth(612)
									charactersEnd += 1500
									const textOfPage = emailText.substring(charactersStart, charactersEnd)
									charactersStart += 1500
									console.log("Start",charactersStart)
									console.log("End",charactersEnd)
									pages[pageNumber].drawText(textOfPage, {
										x: 35,
										y: pages[pageNumber].getHeight() / 2 + 350,
										size: 12,
										font: customFont,
										color: rgb(0, 0, 0),
										maxWidth: 700
									})
								}
							}
						} else {
							page.drawText(emailText, {
								x: 35,
								y: page.getHeight() / 2 + 285,
								size: 12,
								font: customFont,
								color: rgb(0, 0, 0),
								maxWidth: 600
							})
						}
					
						
						page.drawRectangle({
							x: 10,
							y: 0,
							width: 10,
							height: 2000,
							borderColor: rgb(0.502, 0.502, 0.5),
							borderWidth: 1.5,
							color: rgb(0.502, 0.502, 0.502),
						})
		
						const stamp = fs.readFile('images/Symbol.png', Uint8Array, async function (err, stamp) {
							
							// Formatting of file path
							const filePathRaw = `uploads/${userEmail}-${emailSubject}-${new Date()}.pdf`
							const filePath = filePathRaw.replace(/\s+/g, '-')

							if (attachmentsBuff) {				
								const mergedPdf = await PDFDocument.create();

								const pdfB = await PDFDocument.load(attachmentsBuff);

								const copiedPagesA = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
								copiedPagesA.forEach((page) => mergedPdf.addPage(page));

								const copiedPagesB = await mergedPdf.copyPages(pdfB, pdfB.getPageIndices());
								copiedPagesB.forEach((page) => mergedPdf.addPage(page));

								const mergedPdfFile = await mergedPdf.save();
								const data = new Uint8Array(mergedPdfFile);
								fs.writeFileSync(filePath, data, (err) => {
									if (err) throw err;
									console.log('3.The file has been saved!')
								})
							} else {
								const pdfBytes = await pdfDoc.save()
								const data = new Uint8Array(pdfBytes);
								// filePath is path to which the file will be created
								fs.writeFileSync(filePath, data, (err) => {
									if (err) throw err;
									console.log('3.The file has been saved!')
								})
							}	
		
							// Bucket name for Google Storage
							const bucketName = 'docical-emails-original'
		
							// The new ID for your GCS file
							const destFileName = filePath.replace("uploads/", "")
		
							async function uploadFile() {
								await storage.bucket(bucketName).upload(filePath, {
									destination: destFileName,
								});
					
								console.log(`4.${destFileName} uploaded to ${bucketName}`)
							}
							uploadFile().catch(console.error);

							await addStamp.addDetailing(
								first_name, 
								last_name, 
								user_id, 
								docType, 
								filePath,
								qrCode,
								email_id,
								"Not recorded",
								page_url,
								userEmail,
								async function(securedFileUrl) {
									emailObject.securedFileUrl = securedFileUrl
									let pdfFileDetails = []
									pdfFileDetails.push(`https://storage.cloud.google.com/docical-emails-original/${encodeURIComponent(destFileName)}`)
									pdfFileDetails.push(filePath) 
									pdfFileDetails.push(emailObject.securedFileUrl)
									fn(pdfFileDetails)
	
								}
							)
						})
					})
				}
				createPdf()
			})
}

exports.convertEmail2Pdf = convertEmail2Pdf
