const { nanoid } = require('nanoid')
const { createQRCode } = require('./qr-code')

async function createDocumentId(documentId)	{
	const documentIdParameters = []
	const nanoID = await nanoid()
	documentIdParameters.push(nanoID)
	documentIdParameters.push(`${process.env.CLIENT_URL}/document/${documentId}`)
	documentIdParameters.push(await createQRCode(`${process.env.CLIENT_URL}/document/${documentId}`, 500, documentId))
	return documentIdParameters
}

exports.createDocumentId = createDocumentId;


async function createVersionId(versionId)	{
	const versionIdParameters = []
	const nanoID = await nanoid()
	versionIdParameters.push(nanoID)
	versionIdParameters.push(`${process.env.CLIENT_URL}/document/version/${versionId}`)
	versionIdParameters.push(await createQRCode(`${process.env.CLIENT_URL}/document/version/${versionId}`, 500, versionId))
	return versionIdParameters
}

exports.createVersionId = createVersionId;

async function createEmailId(emailId)	{
	const emailIdParameters = []
	const nanoID = await nanoid()
	emailIdParameters.push(nanoID)
	emailIdParameters.push(`${process.env.CLIENT_URL}/document/email/${emailId}`)
	emailIdParameters.push(await createQRCode(`${process.env.CLIENT_URL}/document/email/${emailId}`, 500, emailId))
	return emailIdParameters
}

exports.createEmailId = createEmailId;
