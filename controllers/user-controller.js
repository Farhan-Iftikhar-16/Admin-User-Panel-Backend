const express = require('express');
const User = require('../models/user-model');

const router = express.Router();

router.post('/create-user', (req, res) => {
  User.createUser(req, res);
});

router.put('/update-user/:id', (req, res) => {
  User.updateUser(req, res);
});

router.get('/get-user-by-id/:id', (req, res) => {
  User.getUserByID(req, res);
});

router.get('/get-users', (req, res) => {
  User.getUsers(req, res);
});

router.put('/update-user-status/:id', (req, res) => {
  User.updateUserStatus(req, res);
});

module.exports = router;
