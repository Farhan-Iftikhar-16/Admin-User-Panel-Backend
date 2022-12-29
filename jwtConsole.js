const docusign = require('docusign-esign');
const signingViaEmail = require('./lib/eSignature/examples/signingViaEmail');
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();
const jwtConfig = require('./jwtConfig.json');
const filesPath = path.resolve(__dirname, './public/files');


const SCOPES = [
     "signature", "impersonation"
];

function getConsent() {
  var urlScopes = SCOPES.join('+');

  // Construct consent URL
  var redirectUri = "https://developers.docusign.com/platform/auth/consent";
  var consentUrl = `${jwtConfig.dsOauthServer}/oauth/auth?response_type=code&` +
                      `scope=${urlScopes}&client_id=${jwtConfig.dsJWTClientId}&` +
                      `redirect_uri=${redirectUri}`;

  console.log("Open the following URL in your browser to grant consent to the application:");
  console.log(consentUrl);
  console.log("Consent granted? \n 1)Yes \n 2)No");
  let consentGranted = prompt("");
  if(consentGranted === "1"){
    return true;
  } else {
    console.error("Please grant consent!");
    process.exit();
  }
}

async function authenticate(){
  const jwtLifeSec = 10 * 60, // requested lifetime for the JWT is 10 min
    dsApi = new docusign.ApiClient();
  dsApi.setOAuthBasePath(jwtConfig.dsOauthServer.replace('https://', '')); // it should be domain only.
  let rsaKey = fs.readFileSync(jwtConfig.privateKeyLocation);

  try {
    const results = await dsApi.requestJWTUserToken(jwtConfig.dsJWTClientId,
      jwtConfig.impersonatedUserGuid, SCOPES, rsaKey,
      jwtLifeSec);
    const accessToken = results.body.access_token;

    // get user info
    const userInfoResults = await dsApi.getUserInfo(accessToken);

    // use the default account
    let userInfo = userInfoResults.accounts.find(account =>
      account.isDefault === "true");

    return {
      accessToken: results.body.access_token,
      apiAccountId: userInfo.accountId,
      basePath: `${userInfo.baseUri}/restapi`
    };
  } catch (e) {
    console.log(e);
    let body = e.response && e.response.body;
    // Determine the source of the error
    if (body) {
        // The user needs to grant consent
      if (body.error && body.error === 'consent_required') {
        if (getConsent()){ return authenticate(); }
      } else {
        // Consent has been granted. Show status code for DocuSign API error
        console.error(`\nAPI problem: Status code ${e.response.status}, message body:
        ${JSON.stringify(body, null, 4)}\n\n`);
      }
    }
  }
}

function getArgs(apiAccountId, accessToken, basePath, docObj){
  // signerEmail = prompt("Enter the signer's email address: ");
  // signerName = prompt("Enter the signer's name: ");
  // ccEmail = prompt("Enter the carbon copy's email address: ");
  // ccName = prompt("Enter the carbon copy's name: ");

  const envelopeArgs = {
    signerEmail: docObj.email,
    signerName: docObj.name,
    ccEmail: 'farhaniftikhar16f16@gmail.com',
    ccName: 'Farhan Iftikhar',
    status: "sent",
    doc2File: path.resolve(filesPath, docObj.fileName)
  };

  return {
    accessToken: accessToken,
    basePath: basePath,
    accountId: apiAccountId,
    envelopeArgs: envelopeArgs
  }
}

async function main(docObj){
  let accountInfo = await authenticate();
  let args = getArgs(accountInfo.apiAccountId, accountInfo.accessToken, accountInfo.basePath, docObj);
  await signingViaEmail.sendEnvelope(args);
}

module.exports.sendDoc = (docObj) => {
  main(docObj).then();
};
