const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
var moment = require('moment');
var SquareConnect = require('square-connect');
var defaultClient = SquareConnect.ApiClient.instance;

// Configure OAuth2 access token for authorization: oauth2
var oauth2 = defaultClient.authentications['oauth2'];
oauth2.accessToken = process.env.SQUARE_TOKEN;

var ordersAPIInstance = new SquareConnect.OrdersApi();
var customersAPIInstance = new SquareConnect.CustomersApi();

function processPost(event) {
    return new Promise((resolve) => {
        var webhook = JSON.parse(event.body)
        var locationId = webhook.data.object.order_created.location_id //"JBKEF2CZ4CC53"
        var orderId = webhook.data.object.order_created.order_id
        var orderBody = new SquareConnect.BatchRetrieveOrdersRequest(); 
        orderBody.order_ids = [orderId]

        ordersAPIInstance.batchRetrieveOrders(locationId, orderBody).then(function(data) {
        //console.log('API called successfully. Returned order count: ' + data.orders.length);


            if (data.orders.length == 1){
                var order = data.orders[0]
                var customerId = order.customer_id //"K0EE7HV6G8S0QD5NPEK03YY0BR"
                var order_date = moment(order.created_at).format('MM/DD/YY h:mm a')

                var total = `$${(order.total_money.amount / 100)}`
                var items = ''
                var message = `********************************\nNEW TABBY TREE ORDER!\n${order_date}\nTOTAL: ${total}\n`

                order.line_items.forEach(item => { 
                    var unit_price = (item.base_price_money.amount / 100)
                    var line_item_price = (item.total_money.amount / 100)
                    items += `${item.quantity} - ${item.name}(${item.variation_name}) $${line_item_price}(${unit_price})\n` 
                }); 

                customersAPIInstance.retrieveCustomer(customerId).then(function(data) {
                    //console.log('API called successfully. Returned data: ' + data.customer.email_address);
                    var first_name = data.customer.given_name
                    var last_name = data.customer.family_name

                    message += `FROM: ${first_name} ${last_name}\n--------------------------------\n${items}********************************`
                    console.log(message);

                    //push to dynamo
                    var params = {
                        TableName : 'OrderPrinter',
                        Item: {
                           order_id: orderId,
                           customer_id: customerId,
                           created_at: order.created_at,
                           sent_to_printer: false,
                           message: message
                        }
                    };

                    dynamo.put(params, function(err, data) {
                        if (err) throw new Error(`Failed to insert into dynamo:"${err}"`);
                        else resolve(data);
                      });                    
                
                }, function(error) {
                    throw new Error(`Failed to fetch customer from square:"${error}"`);
                });
            } else {
                //Something wrong
                throw new Error(`Unexpected results from fetch order: "${data}"`);
            }

        }, function(error) {
            throw new Error(`Failed to fetch order from square:"${error}"`);
        });
    })
}

function processGet(event) {
    return new Promise((resolve) => {
        // var params = {
        //     TableName : 'OrderPrinter',
        //     Key: {
        //         order_id: 'l1DgeB9M4wStjloWM6WKZpF5TyNZY'
        //     }
        // };

        var params = {
            TableName : 'OrderPrinter',
            FilterExpression : 'sent_to_printer = :sent_to_printer',
            ExpressionAttributeValues : {':sent_to_printer' : false}
        };
        
        dynamo.scan(params, function(err, data) {
            
            if (err) throw new Error(`Failed to fetch from dynamo:"${err}"`);
            else {
                var returnData = {messages:[]};
                console.log(JSON.stringify(data));
                if(data.Count > 0){
                var item = data.Items[0]
                //data.Items.forEach(item => { 
                    //TODO: Update sent_to_printer to false...actually may want to make a separate call for that
                    returnData.messages.push(`${item.message}\n`);

                    item.sent_to_printer = true;

                    var params = {
                        TableName : 'OrderPrinter',
                        Item: item
                    };

                    dynamo.put(params, function(err, data) {
                        if (err) throw new Error(`Failed to update dynamo:"${err}"`);
                        else resolve(returnData); //This won't work for multiple items, but since we are only fetching should be good
                    });  
                //}); 
                } else {
                    resolve({messages:[]});
                }
            }
        });
    })
}

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    let body='';
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        switch (event.requestContext.http.method) {
            case 'DELETE':
                throw new Error(`Unsupported method "${event.httpMethod}"`);    
                //body = await dynamo.delete(JSON.parse(event.body)).promise();
                //break;
            case 'GET':
                //body = await dynamo.scan({ TableName: event.queryStringParameters.TableName }).promise();
                body = await processGet(event);
                break;
            case 'POST':
                
                body = await processPost(event);
                break;
                //body = await dynamo.put(JSON.parse(event.body)).promise();
                
            case 'PUT':
                throw new Error(`Unsupported method "${event.httpMethod}"`);
                //body = await dynamo.update(JSON.parse(event.body)).promise();
                //break;
            default:
                throw new Error(`Unsupported method "${event.httpMethod}"`);
        }
    } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers,
    };
};
