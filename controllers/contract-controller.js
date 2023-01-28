const express = require('express');
const Contract = require('../models/contract-model');

const router = express.Router();

router.post('/create-contract'  , (req, res) => {
  Contract.createContract(req, res);
});

router.post('/create-signing-URL'  , (req, res) => {
  Contract.createContractSigningURL(req, res);
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

router.put('/contract-signed', (req, res) => {
  Contract.contractSigned(req, res);
});

router.get('/get-contracts-by-user-id/:userId', (req, res) => {
  Contract.getContractsByUserId(req, res);
});

module.exports = router;
