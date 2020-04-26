// Dear Future Dave: Use this for QR Code https://github.com/ricmoo/QRCode
var moment = require('moment');
var SquareConnect = require('square-connect');
var defaultClient = SquareConnect.ApiClient.instance;

// Configure OAuth2 access token for authorization: oauth2
var oauth2 = defaultClient.authentications['oauth2'];
oauth2.accessToken = process.env.SQUARE_TOKEN;

var ordersAPIInstance = new SquareConnect.OrdersApi();
var customersAPIInstance = new SquareConnect.CustomersApi();

var webhook = {
	"merchant_id": "MRA6DW7Y5P9Q5",
	"type": "order.created",
	"event_id": "4d19b99c-a9c1-4912-9b5c-c3950304f685",
	"created_at": "2020-04-25T14:24:24.603Z",
	"data": {
		"type": "order",
		"id": "l1DgeB9M4wStjloWM6WKZpF5TyNZY",
		"object": {
			"order_created": {
				"created_at": "2020-04-25T14:24:24.603Z",
				"location_id": "JBKEF2CZ4CC53",
				"order_id": "l1DgeB9M4wStjloWM6WKZpF5TyNZY",
				"state": "OPEN",
				"version": 1
			}
		}
	}
}

var locationId = webhook.data.object.order_created.location_id //"JBKEF2CZ4CC53"
var orderId = webhook.data.object.order_created.order_id
var body = new SquareConnect.BatchRetrieveOrdersRequest(); 
body.order_ids = [orderId]

ordersAPIInstance.batchRetrieveOrders(locationId, body).then(function(data) {
  console.log('API called successfully. Returned order count: ' + data.orders.length);


    if (data.orders.length == 1){
        var order = data.orders[0]
        var customerId = order.customer_id //"K0EE7HV6G8S0QD5NPEK03YY0BR"
        var order_date = moment(order.created_at).format('MM/DD/YY h:mm a')

        var total = `$${(order.total_money.amount / 100)}`
        var items = ''
        var message = `*********************\nNEW TABBY TREE ORDER!\n${order_date}\nTOTAL: ${total}\n`

        order.line_items.forEach(item => { 
            var unit_price = (item.base_price_money.amount / 100)
            var line_item_price = (item.total_money.amount / 100)
            items += `${item.quantity} - ${item.name}(${item.variation_name}) $${line_item_price}(${unit_price})\n` 
        }); 

        customersAPIInstance.retrieveCustomer(customerId).then(function(data) {
            console.log('API called successfully. Returned data: ' + data.customer.email_address);
            var first_name = data.customer.given_name
            var last_name = data.customer.family_name

            message += `FROM: ${first_name} ${last_name}\n-----------------\n${items}*********************`
            console.log(message);
        }, function(error) {
            console.error(error);
        });
    } else {
        //Something wrong
    }

}, function(error) {
  console.error(error);
});


