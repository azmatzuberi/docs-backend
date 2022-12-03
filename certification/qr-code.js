const { AwesomeQR } = require("awesome-qr");
const fs = require("fs");
const { addDetailing } = require("./add_stamp")
// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');
// Creates a client
const storage = new Storage();
const bucketName = 'docical-qr-codes';

async function createQRCode(text, size, id) {
	const buffer = await new AwesomeQR({ text, size }).draw();
	const filePath = `qr-codes-generation/${id}-qrcode.png`
	fs.writeFileSync(filePath, buffer);

	async function uploadFile() {
		await storage.bucket(bucketName).upload(filePath, {
		  destination: filePath,
		});
	
		console.log(`2.${filePath} uploaded to ${bucketName}`);
	}
	
	uploadFile().catch(console.error);

	return filePath
}

exports.createQRCode = createQRCode;
