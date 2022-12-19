const config = require("../config/config");
const express = require("express");
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/payment', (req, res) => {
  createCustomer(req.body).then(response => {
    stripe.charges.create({
      amount: value.amount,
      description: 'Web Development Product',
      currency: 'USD',
      customer: response.id
    });
  }).then(() => {
    res.status(200).json({success: true, message: 'Payment done successfully'});
  }).catch(error => {
    res.status(500).json({success: false, message: 'Error occurred while payment', error: error})
  });
});

router.get('/products', async (req, res) => {
  stripe.products.list().then(response => {
    res.status(200).json({success: true, products: response.data})
  }).catch(error => {
    res.status(500).json({success: false, message: 'Error occurred while getting products', error: error})
  });
});

router.post('/subscription', (req, res) => {
  createCustomer(req.body).then(response => {

  })
  stripe.subscriptions.create({
    customer: 'cus_MsPWQOaudvhIMf',
    items: [
      {price: 'price_1M93x62eZvKYlo2Caz6fEec6'},
    ],
  }).then(() => {
    res.status(200).json({success: true, message: 'Subscription created successfully.'});
  }).catch(() => {
    res.status(500).json({success: false, message: 'Error occurred while creating subscription.'});
  });
})

function createCustomer(value) {
  return new Promise((resolve, reject) => {
    stripe.customers.create({
      email: value.email,
      source: value.token,
      name: 'Farhan Iftikhar',
    }).then((customer) => {
      resolve(customer);
    }).catch(() => {
      reject();
    })
  });
}

module.exports = router;
