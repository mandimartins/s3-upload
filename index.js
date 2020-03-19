const express = require('express');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads' });
const fs = require('fs');
const config = require('config');

const s3default = {
  accessKeyId: config.get('S3_ACCESS_KEY_ID'),
  secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
  region: config.get('S3_REGION'),
  bucket: config.get('S3_BUCKET')
};

const dbDefault = {
  hostname: config.get('DB_HOSTNAME'),
  port: config.get('DB_PORT'),
  dbName: config.get('DB_NAME'),
  username: config.get('DB_USERNAME'),
  password: config.get('DB_PASSWORD')
};

const app = express();

const s3 = require('@auth0/s3');

const port = process.env.PORT || 3000;

const s3Config = {
  accessKeyId: process.env.S3_ACCESS_KEY || s3default.accessKeyId,
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY || s3default.secretAccessKey,
  region: process.env.S3_REGION || s3default.region,
  bucket: process.env.S3_BUCKET || s3default.bucket
};

const dbDSettings = {
  hostname: process.env.RDS_HOSTNAME || dbDefault.hostname,
  port: process.env.RDS_POST || dbDefault.port,
  dbName: process.env.RDS_DB_NAME || dbDefault.dbName,
  username: process.env.RDS_USERNAME || dbDefault.username,
  password: process.env.RDS_PASSWORD || dbDefault.password
};

const Sequelize = require('sequelize');
const sequelize = new Sequelize(
  dbDSettings.dbName,
  dbDSettings.username,
  dbDSettings.password,
  {
    dialect: 'mysql',
    host: dbDSettings.hostname
  }
);

const Arquivo = sequelize.define('Arquivo', {
  name: Sequelize.STRING
});

const client = s3.createClient({
  s3Options: s3Config
});

const aws = require('aws-sdk');

aws.config = new aws.Config(s3Config);

const s3SDK = new aws.S3();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  const arquivos = await Arquivo.findAll();
  res.render('index', { arquivos });
});

app.get('/ver/:id', async (req, res) => {
  const arquivo = await Arquivo.findAll({
    where: {
      id: req.params.id
    }
  });

  const s3File = {
    Bucket: s3Config.bucket,
    Key: arquivo[0].dataValues.name,
    Expires: 10
  };
  const signedUrl = s3SDK.getSignedUrl('getObject', s3File);

  res.redirect(signedUrl);
});

const uploadToS3 = (file, key, mimetype, s3Config) => {
  const params = {
    localFile: file,
    s3Params: {
      Bucket: s3Config.bucket,
      Key: key,
      ContentType: mimetype
    }
  };

  return new Promise((resolve, reject) => {
    const uploader = client.uploadFile(params);
    uploader.on('end', () => {
      resolve();
    });
  });
};

const removeFile = file => {
  return new Promise((resolve, reject) => {
    fs.unlinkSync(file, err => {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
};

app.post('/upload', upload.single('foto'), async (req, res) => {
  await Arquivo.create({
    name: req.file.originalname
  });

  await uploadToS3(
    req.file.path,
    req.file.originalname,
    req.file.mimetype,
    s3Config
  );

  res.redirect('/');

  await removeFile(req.file.path);
});

sequelize.sync().then(() => {
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
});
