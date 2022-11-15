const express = require('express');
const User = require('../models/user-model.js');

const router = express.Router();

router.post('/login', (req, res) => {
  User.getUserByEmail(req, res);
});

router.post('/send-reset-password-email', (req, res) => {
  User.sendResetPasswordEmail(req, res);
});

router.post('/verify-token', (req, res) => {
  User.verifyToken(req, res);
});

router.post('/reset-password', (req, res) => {
  User.resetPassword(req, res);
});

module.exports = router;
