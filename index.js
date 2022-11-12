const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config/config')
const app = express();
const server = require('http').Server(app);
const USERS = require('./models/user-model');
const bcryptjs = require("bcryptjs");
const authController = require('./controllers/auth-controller');
const userController = require('./controllers/user-controller');
const contractController = require('./controllers/contract-controller');

mongoose.connect(config.mongoURL).then(async () => {
  console.log(`Connected to DB: ${config.mongoURL}`);

  const user =  await USERS.findOne({role: 'ADMIN'});

  if (!user) {
    const user = new USERS({
      firstName: 'Admin',
      lastName: 'Admin',
      email: 'admin@gmail.com',
      password: 'Admin@123',
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const salt = await bcryptjs.genSalt(10);

    if (salt) {
      const hash = await bcryptjs.hash(user.password, salt);

      if (hash) {
        user.password = hash;

        await user.save();
      }
    }
  }

});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(cors());

app.options('*', cors());

app.use('/auth', authController);
app.use('/users', userController);
app.use('/contracts', contractController);

server.listen(config.PORT, () => {
  console.log(`Server Running On Port: ${config.PORT}`)
})
