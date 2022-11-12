const express = require('express');
const Contract = require('../models/contract-model');
const multer = require("multer");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './files');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now())
  }
});

let upload = multer({
  storage: storage
});

router.post('/create-contract', upload.single('file')  , (req, res) => {
  Contract.createContract(req, res);
});

router.put('/update-contract/:id', (req, res) => {
  Contract.updateContract(req, res);
});

router.get('/get-contract-by-id/:id', (req, res) => {
  Contract.getContractByID(req, res);
});

router.get('/get-contracts', (req, res) => {
  Contract.getContracts(req, res);
});

router.put('/update-contract-status/:id', (req, res) => {
  Contract.updateContractStatus(req, res);
});

module.exports = router;
