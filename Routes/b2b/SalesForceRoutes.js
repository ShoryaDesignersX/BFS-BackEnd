const express = require("express")
const { login, accountDetails, getAllAccounts, getAccountByName, getProduct, getDiscount, getImage, getImage2, getImageFinal, imageDownload, getDownloadUrl, base64, flitSync, downloadUrl, testQuery, getAccountAddress, OrderPunch } = require("../../Controller/SalesForceController");

const router = express.Router();


router.post('/login',login)
router.get('/getaccountdetails',accountDetails)
router.get('/getaccounts',getAllAccounts)
router.post('/getaccountsbyname',getAccountByName)
router.post('/getproducts',getProduct)
router.post('/accountaddress',getAccountAddress)
router.post('/orderpunch',OrderPunch)

// test
router.get('/getDiscount',getDiscount)
// image
router.get('/getimage',getImage)
router.get('/base64',base64)
router.get('/downloadurl',downloadUrl)

// test query   
router.get('/test',testQuery)



module.exports = { router };
