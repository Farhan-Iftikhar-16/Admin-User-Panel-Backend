const mongoose = require('mongoose');
const User = require('./user-model');
const multer = require("multer");
const path = require("path");
const doc = require("../jwtConsole");

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
      res.status(500).json({status: 'Error', message: 'Error occurred while creating contract.'});
      return;
    }

    const contract = new Contract({
      userId: req.body.userId,
      type: req.body.type,
      file: req.file,
      status: 'AWAITING_SIGNATURE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    contract.save(async error=> {
      if(error) {
        res.status(500).json({success: false, message: 'Error occurred while creating contract.'});
        return;
      }

      if(!error) {
        const user = await User.findOne({userId: contract.userId});

        if (user) {
          const docObj = {
            email: user.email,
            name: user.firstName + ' ' + user.lastName,
            fileName: contract.file.filename
          };

          doc.sendDoc(docObj);
        }

        res.status(200).json({success: true, message: 'Contract created successfully.'});
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
  Contract.find({}, async (error, response) => {
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

module.exports.getContractsByUserId = (req, res) => {
  Contract.find( [{$and: [{ role: {$ne: 'ADMIN'} }, { userId: { $regex: req.query.text, $options: 'i'} }]}], ((error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while getting contracts.'});
      return;
    }

    if (response && response.length > 0) {
      const contracts = [];

      if (response && response.length > 0) {
        for (const contract of response) {
          const data = {
            _id: contract._id,
            type: contract.type,
            userId: contract.userId,
            status: contract.status,
            documentName: contract.file.originalname
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
