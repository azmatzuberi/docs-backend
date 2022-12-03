const dbDebugger = require('debug')('app:db')
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
const morgan = require('morgan')
const helmet = require('helmet')
const logger = require('./logs/logger')
const documents = require('./routes/documents')
const doc_versions = require('./routes/doc_versions')
const emails = require('./routes/emails')
const email_versions = require('./routes/email_versions')
const users = require('./routes/users')
const collaborators = require('./routes/collaborators')
const express = require('express')
const cors = require('cors')
const app = express()
const mongoose = require('mongoose')
const xFrameOptions = require('x-frame-options')
const fs = require('fs')
const uploadedDir = './uploads'
const qrDir = './qr-codes-generation'
const securedDocsDir = './securedDocuments'
const downloadedDir = './downloaded'
const imagesDir = './images'
const gotenbergDir = './gotenbergSaved'
const pdf2pngDir = './pdf2png'
const gmail = require('./gmail/getEmails.js')

if (!fs.existsSync(uploadedDir)) {
	fs.mkdirSync(uploadedDir)
}
if (!fs.existsSync(qrDir)) {
	fs.mkdirSync(qrDir)
}
if (!fs.existsSync(securedDocsDir)) {
	fs.mkdirSync(securedDocsDir)
}
if (!fs.existsSync(downloadedDir)) {
	fs.mkdirSync(downloadedDir)
}
if (!fs.existsSync(imagesDir)) {
	fs.mkdirSync(imagesDir)
}
if (!fs.existsSync(gotenbergDir)) {
	fs.mkdirSync(gotenbergDir)
}
if (!fs.existsSync(pdf2pngDir)) {
	fs.mkdirSync(pdf2pngDir)
}

mongoose
  .connect(`${process.env.DB_HOST}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useNewUrlParser: true
  })
  .then(() => dbDebugger('Connected to MongoDB'))
  .catch((err) => console	.error('Could not connect to MongoDB...', err));

app.use(xFrameOptions());

// app.use(express.json());

app.use(cors());

app.use(logger);

app.use(helmet());

app.use('/api/collaborators', collaborators);

app.use('/api/documents', documents);

app.use('/api/users', users);

app.use('/api/doc_versions', doc_versions);

app.use('/api/emails', emails);

app.use('/api/email_versions', email_versions);

// app.use('/api/flowers', flowers);

if (app.get('env') === 'development') {
  app.use(morgan('tiny'));
  dbDebugger('Morgan enabled...');
}

// DB
dbDebugger('Connected to the database');

app.use(function (req, res, next) {
  console.log('Authenticating... ');
  next();
});

app.get('/', function (req, res) {
	res.get('X-Frame-Options') // === 'Deny'
});

console.log("Client resource:", process.env.CLIENT_DOMAIN)

// PORT
app.listen(process.env.SERVER_PORT, () => console.log(`Listening on port ${process.env.SERVER_PORT};`));
