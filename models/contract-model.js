const mongoose = require('mongoose');
const User = require('./user-model');
const multer = require("multer");
const path = require("path");
const config = require("../config/config");
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const docusign = require('docusign-esign');
const fs = require('fs');
const jwtConfig = require("../jwtConfig.json");

const SCOPES = ["signature", "impersonation"];
const rsaKey = fs.readFileSync(jwtConfig.privateKeyLocation);
const jwtLifeSec = 10 * 60

const contractSchema = mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  file: {
    type: Object,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  price: {
    type: String,
    required: true
  },
  interval: {
    type: String,
    required: true
  },
  intervalCount: {
    type: String,
    required: true
  },
  product: {
    type: String,
    required: false
  },
  contractSigningURL: {
    type: false,
    required: false
  },
  createdAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date,
    required: true
  }
});

const Contract = module.exports = mongoose.model('Contract', contractSchema);


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/files/');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

let upload = multer({
  storage: storage
}).single('file');


module.exports.createContract = (req , res) => {
  upload(req, res, error => {
    if (error) {
      console.log(error);
      res.status(500).json({status: 'Error', message: 'Error occurred while creating contract.'});
      return;
    }

    const contract = new Contract({
      userId: req.body.userId,
      type: req.body.type,
      file: req.file,
      price: req.body.price,
      interval: req.body.interval,
      intervalCount: req.body.intervalCount,
      status: 'AWAITING_SIGNATURE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    contract.save(async (error, response) => {
      if(error) {
        console.log(error);
        return res.status(500).json({success: false, message: 'Error occurred while creating contract.'});
      }

      if(!error) {
         const product = await stripe.products.create({
           name: response.file.filename,
           metadata: { contractId: response._id }
         }).catch((error) => {
            console.log(error);
           return res.status(500).json({success: false, message: error.raw.message});
         });

         const price = await stripe.prices.create({
           unit_amount: response.price * 100,
           currency: 'usd',
           product: product.id,
           recurring: {
             interval: contract.interval.toLowerCase(),
             interval_count: contract.intervalCount
           },
           metadata: { contractId: response._id }
         }).catch((error) => {
           console.log(error);
           return res.status(500).json({success: false, message: error.raw.message});
         });

         await stripe.products.update(product.id, {default_price: price.id}).catch((error) => {
           console.log(error);
           return res.status(500).json({success: false, message: error.raw.message});
         });

         await Contract.findByIdAndUpdate(response._id, {product: product.id}).catch((error) => {
           console.log(error);
           return res.status(500).json({success: false, message: error.raw.message});
         });

        const user = await User.findOne({userId: contract.userId});

        if (user) {
          const dsApiClient = new docusign.ApiClient();
          dsApiClient.setBasePath(jwtConfig.basePath);
          const requestJWTUserToken = await dsApiClient.requestJWTUserToken(
            jwtConfig.dsJWTClientId, jwtConfig.impersonatedUserGuid, SCOPES, rsaKey, jwtLifeSec)
          .catch(error => {
            console.log(error);
            const urlScopes = SCOPES.join('+');
            const redirectUri = "http://localhost:4300/admin/edit-contract/0?consent_required=true";
            if (error.response.body.error && error.response.body.error === 'consent_required') {
              res.status(200).json({success: true, type: 'CONSENT_REQUIRED', message: 'Contract created successfully', id: response._id,
                consentRequiredURL: `${jwtConfig.dsOauthServer}/oauth/auth?response_type=code&scope=${urlScopes}&client_id=${jwtConfig.dsJWTClientId}&redirect_uri=${redirectUri}`});
            }
          });

          if (requestJWTUserToken && requestJWTUserToken.body && requestJWTUserToken.body.access_token) {
            const accessToken = requestJWTUserToken.body.access_token;
            dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
            const envelopesApi = new docusign.EnvelopesApi(dsApiClient)

            // Make the envelope request body
            const envelope = createEnvelope(user, response);

            // Call Envelopes::create API method
            // Exceptions will be caught by the calling function
            const createdEnvelope = await envelopesApi.createEnvelope(jwtConfig.accountId, {envelopeDefinition: envelope});

            // Create the recipient view, the Signing Ceremony
            let viewRequest = makeRecipientViewRequest(user, response._id);
            // Call the CreateRecipientView API
            // Exceptions will be caught by the calling function
            let results = await envelopesApi.createRecipientView(jwtConfig.accountId, createdEnvelope.envelopeId,
              {recipientViewRequest: viewRequest});
            results = {... results};

            await Contract.findByIdAndUpdate(response._id, {contractSigningURL: results.url}).catch((error) => {
              console.log(error);
              return res.status(500).json({success: false, message: error});
            });

            res.status(200).json({success: true, message: 'Contract created successfully.'});
          }
        }
      }
    });
  });
}

module.exports.updateContract = (req , res) => {
  Contract.findOneAndUpdate({_id: req.params.id}, req.body,{}, error => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating details of contract.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'Contract details updated successfully.'});
    }
  });
}

module.exports.getContractByID = (req , res) => {
  Contract.findById(req.params.id, req.body,{}, (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while getting contracts.'});
      return;
    }

    if (response) {
      const contract = {
        _id: response._id,
        userId: response.userId,
        file: response.file,
        type: response.type,
        status: response.status,
        interval: response.interval,
        intervalCount: response.intervalCount,
        price: response.price,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      }
      res.status(200).json({success: true, contract: contract});
      return;
    }

    if (!response) {
      res.status(200).json({success: true, contract: {}});
    }
  });
}

module.exports.getContracts = (req, res) => {
  Contract.find({}, async (error, response) => {
    if (error) {
      console.log(error);
      res.status(500).json({status: 'Error', message: 'Error occurred while getting contracts.'});
      return
    }

    if (response && response.length > 0) {
      const contracts = [];

      if (response && response.length > 0) {
        for (const contract of response) {
          const user = await User.findOne({userId: contract.userId});
          const data = {
            _id: contract._id,
            type: contract.type,
            userId: contract.userId,
            user: {
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              userId: user.userId
            },
            file: contract.file,
            status: contract.status,
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt
          };

          contracts.push(data);
        }
      }

      res.status(200).json({status: 'Success', contracts: contracts});
      return;
    }

    res.status(200).json({status: 'Success', contracts: []});
  });
}

module.exports.getContractsByUserId = (req, res) => {
  Contract.find( {
    $and: [{ role: {$ne: 'ADMIN'} }, {userId: { '$regex': req.params.userId, $options: 'i'}}]
  },  (async (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while getting contracts.'});
      return;
    }

    if (response && response.length > 0) {
      const contracts = [];

      if (response && response.length > 0) {
        for (const contract of response) {
          const product = await stripe.products.retrieve(contract.product);
          const data = {
            _id: contract._id,
            type: contract.type,
            userId: contract.userId,
            status: contract.status,
            documentName: contract.file.originalname,
            price: contract.price,
            interval: contract.interval,
            intervalCount: contract.intervalCount,
            contractSigningURL: contract.contractSigningURL,
            product: product
          };

          contracts.push(data);
        }
      }

      res.status(200).json({status: 'Success', contracts: contracts});
      return;
    }

    res.status(200).json({status: 'Success', contracts: []});
  }));
}

module.exports.updateContractStatus = (req, res) => {
  Contract.findOneAndUpdate({_id: req.params.id}, {status: req.body.status},{}, (error) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating status of contract.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'Contract status updated successfully.'});
    }
  });
}

module.exports.createContractSigningURL = (req, res) => {
  Contract.findById(req.body.contractId, async (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating status of contract.'});
      return;
    }

    if (!error) {
      const user = await User.findOne({userId: response.userId});
      const dsApiClient = new docusign.ApiClient();
      dsApiClient.setBasePath(jwtConfig.basePath);
      const requestJWTUserToken = await dsApiClient.requestJWTUserToken(
        jwtConfig.dsJWTClientId, jwtConfig.impersonatedUserGuid, SCOPES, rsaKey, jwtLifeSec);

      if (requestJWTUserToken && requestJWTUserToken.body && requestJWTUserToken.body.access_token) {
        const accessToken = requestJWTUserToken.body.access_token;
        dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
        const envelopesApi = new docusign.EnvelopesApi(dsApiClient)

        // Make the envelope request body
        const envelope = createEnvelope(user, response);

        // Call Envelopes::create API method
        // Exceptions will be caught by the calling function
        const createdEnvelope = await envelopesApi.createEnvelope(jwtConfig.accountId, {envelopeDefinition: envelope});

        // Create the recipient view, the Signing Ceremony
        let viewRequest = makeRecipientViewRequest(user, response._id);
        // Call the CreateRecipientView API
        // Exceptions will be caught by the calling function
        let results = await envelopesApi.createRecipientView(jwtConfig.accountId, createdEnvelope.envelopeId,
          {recipientViewRequest: viewRequest});
        results = {... results};

        await Contract.findByIdAndUpdate(response._id, {contractSigningURL: results.url}).catch((error) => {
          console.log(error);
          return res.status(500).json({success: false, message: error});
        });

        res.status(200).json({success: true, message: 'Contract Signing URL created successfully.'});
      }

      res.status(500).json({success: false, message: 'Error Occured while creating contract signing URL.'});
    }
  });
}

module.exports.contractSigned = (req, res) => {
  Contract.findOneAndUpdate({_id: req.body.contractId}, {status: 'SIGNED'},{}, (error) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating status of contract.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'Contract signed successfully.'});
    }
  });
}

function createEnvelope(user, contract) {
  // read file from a local directory
  // The read could raise an exception if the file is not available!
  const docPdfBytes = fs.readFileSync(path.resolve('public/files', contract.file.filename));

  // create the envelope definition
  let env = new docusign.EnvelopeDefinition();
  env.emailSubject = 'Please sign this document';

  // add the documents
  let doc1 = new docusign.Document();


doc1.documentBase64 = Buffer.from(docPdfBytes).toString('base64');
  doc1.name = 'Lorem Ipsum'; // can be different from actual file name
  doc1.fileExtension = 'pdf';
  doc1.documentId = '3';

  // The order in the docs array determines the order in the envelope
  env.documents = [doc1];

  // Create a signer recipient to sign the document, identified by name and email
  // We set the clientUserId to enable embedded signing for the recipient
  // We're setting the parameters via the object creation
  let signer1 = docusign.Signer.constructFromObject({
    email: user.email,
    name: user.firstName + ' ' + user.lastName,
    clientUserId: jwtConfig.impersonatedUserGuid,
    recipientId: 1
  });

  // Create signHere fields (also known as tabs) on the documents,
  // We're using anchor (autoPlace) positioning
  //
  // The DocuSign platform seaches throughout your envelope's
  // documents for matching anchor strings.
  let signHere1 = docusign.SignHere.constructFromObject({
    anchorString: '/sn1/',
    anchorYOffset: '10', anchorUnits: 'pixels',
    anchorXOffset: '20'})
  ;

  // Tabs are set per recipient / signer
  signer1.tabs = docusign.Tabs.constructFromObject({
    signHereTabs: [signHere1]
  });

  // Add the recipient to the envelope object
  env.recipients = docusign.Recipients.constructFromObject({
    signers: [signer1]
  });

  // Request that the envelope be sent by setting |status| to "sent".
  // To request that the envelope be created as a draft, set to "created"
  env.status = 'sent';

  return env;
}

function makeRecipientViewRequest(user, contractId) {
  // Data for this method
  // args.dsReturnUrl
  // args.signerEmail
  // args.signerName
  // args.signerClientId
  // args.dsPingUrl

  let viewRequest = new docusign.RecipientViewRequest();

  // Set the url where you want the recipient to go once they are done signing
  // should typically be a callback route somewhere in your app.
  // The query parameter is included as an example of how
  // to save/recover state information during the redirect to
  // the DocuSign signing ceremony. It's usually better to use
  // the session mechanism of your web framework. Query parameters
  // can be changed/spoofed very easily.
  viewRequest.returnUrl = `${jwtConfig.returnURL}?state=123&contract=${contractId}`;

  // How has your app authenticated the user? In addition to your app's
  // authentication, you can include authenticate steps from DocuSign.
  // Eg, SMS authentication
  viewRequest.authenticationMethod = 'none';

  // Recipient information must match embedded recipient info
  // we used to create the envelope.
  viewRequest.email = user.email;
  viewRequest.userName = user.firstName + ' ' + user.lastName;
  viewRequest.clientUserId = jwtConfig.impersonatedUserGuid;

  // DocuSign recommends that you redirect to DocuSign for the
  // Signing Ceremony. There are multiple ways to save state.
  // To maintain your application's session, use the pingUrl
  // parameter. It causes the DocuSign Signing Ceremony web page
  // (not the DocuSign server) to send pings via AJAX to your
  // app,
  // viewRequest.pingFrequency = 600; // seconds
  // NOTE: The pings will only be sent if the pingUrl is an https address
  // viewRequest.pingUrl = jwtConfig.returnURL; // optional setting

  return viewRequest
}
