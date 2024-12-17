// https://medium.com/@y.mehnati_49486/how-to-send-an-email-from-your-gmail-account-with-nodemailer-837bf09a7628
require('dotenv').config();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Usage: node script.js <email> <product-name>');
    process.exit(1);
}

const [email, productName] = args;

console.log("process.env.MAIL_USERNAME", process.env.MAIL_USERNAME);
console.log(" process.env.MAIL_PASSWORD", process.env.MAIL_PASSWORD);


// Configure email transporter
const transporter = nodemailer.createTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USERNAME, // Replace with your email
        pass: process.env.MAIL_PASSWORD    // Replace with your app password
    }
});

// Function to check product availability
async function checkProductAvailability() {
    try {
        const response = await axios({
            method: 'get',
            url: 'https://shop.amul.com/api/1/entity/ms.products',
            params: {
                'fields[name]': 1,
                'fields[brand]': 1,
                'fields[categories]': 1,
                'fields[collections]': 1,
                'fields[alias]': 1,
                'fields[sku]': 1,
                'fields[price]': 1,
                'fields[available]': 1,
                'fields[inventory_quantity]': 1,
                'fields[inventory_low_stock_quantity]': 1,
                'fields[inventory_allow_out_of_stock]': 1
            },
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'frontend': '1'
            }
        });

        const products = response.data.data;

        for (const product of products) {
            // Check if product name matches (case-insensitive)
            if (product.name.toLowerCase().includes(productName.toLowerCase())) {
                // Check inventory management settings
                if (product.inventory_management === 'automatic' && 
                    product.inventory_management_level === 'product') {

                    const isInStock = !(
                        product.inventory_low_stock_quantity && 
                        product.inventory_allow_out_of_stock !== '1' &&
                        product.inventory_low_stock_quantity > product.inventory_quantity
                    );

                    if (isInStock) {
                        // Send email notification
                        const mailOptions = {
                            from: 'jatinpanjwani111@gmail.com',
                            to: email,
                            subject: 'Product Back in Stock!',
                            html: `
                                <h2>Product is now available!</h2>
                                <p><strong>Product Name:</strong> ${product.name}</p>
                                <p><strong>Current Stock:</strong> ${product.inventory_quantity}</p>
                                <p><strong>Price:</strong> ₹${product.price}</p>
                                <p>Visit <a href="https://shop.amul.com">Amul Shop</a> to place your order.</p>
                            `
                        };

                        await transporter.sendMail(mailOptions);
                        console.log(`Notification sent to ${email} for ${product.name}`);
                        process.exit(0); // Exit after sending notification
                    }
                }
            }
        }

        console.log(`Product "${productName}" still out of stock. Will check again later.`);

    } catch (error) {
        console.error('Error checking product availability:', error.message);
    }
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', checkProductAvailability);

// Initial check
checkProductAvailability();


console.log('Stock monitor started. Checking every 5 minutes...');