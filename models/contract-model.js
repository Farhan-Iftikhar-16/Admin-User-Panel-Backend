const mongoose = require('mongoose');
const User = require('./user-model');

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
  createdAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date,
    required: true
  }
});

const ContractModel = module.exports = mongoose.model('ContractModel', contractSchema);

module.exports.createContract = (req , res) => {
  const contract = new ContractModel({
    userId: req.body.userId,
    type: req.body.type,
    file: req.file,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  contract.save((error)=> {
    if(error) {
      res.status(500).json({success: false, message: 'Error occurred while creating contract.'});
      return;
    }

    if(!error) {
      res.status(200).json({success: true, message: 'ContractModel created successfully.'});
    }
  });
}

module.exports.updateContract = (req , res) => {
  ContractModel.findOneAndUpdate({_id: req.params.id}, req.body,{}, error => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating details of contract.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'ContractModel details updated successfully.'});
    }
  });
}

module.exports.getContractByID = (req , res) => {
  ContractModel.findById(req.params.id, req.body,{}, (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating details of contract.'});
      return;
    }

    if (response) {
      const contract = {
        _id: response._id,
        userId: response.userId,
        file: response.file,
        type: response.type,
        status: response.status,
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
  ContractModel.find({}, async (error, response) => {
    if (error) {
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

module.exports.updateContractStatus = (req, res) => {
  ContractModel.findOneAndUpdate({_id: req.params.id}, {status: req.body.status},{}, (error) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating status of contract.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'Contract status updated successfully.'});
    }
  });
}
