const nodemailer = require("nodemailer");
module.exports = {
  PORT: 5000,
  mongoURL: 'mongodb://localhost:27017/ADMIN_USER_PANEL_Database',
  transporter: nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'farhaniftikhar16f16@gmail.com',
      pass: 'jduroqpxnwyjjvnx'
    }
  }),
  emailFrom: 'farhaniftikhar16f16@gmail.com',
  FRONTEND_URL: 'http://localhost:4200/',
  TOKEN_SECRET: 'ADMIN_USER_PANEL',
  STRIPE_SECRET_KEY: 'sk_test_8M6hv9X154BNbS4VpNBJidf100aWzmVGj6'
};
