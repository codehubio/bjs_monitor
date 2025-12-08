import { config } from "../../config";

const queries =[{
  "name": "Total EAPI calls",
  "query": "NOT eapi_direction:Started",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total HTTP-error non 5xx EAPIs",
  "query": "NOT eapi_direction:Started AND ((eapi_http_status:>=400 AND eapi_http_status:<500) OR eapi_http_status:<200)",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total HTTP-error 5xx EAPIs",
  "query": "eapi_http_status:>=500",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total socket hang up errors",
  "query": "\"socket hang up\" OR \"TLSSocket.socketOnEnd\"",
  "view": config.graylogDefaultNumberView,
}, {
  "name": "Total Cronjob EAPI calls", 
  "query":"eapi_ip:undefined AND NOT eapi_direction:Started",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total EAPI of which duration > 10 seconds",
  "query":"eapi_duration:>10000",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total successful orders",
  "query": "eapi_method: SubmitOrder AND (NOT eapi_direction: Started)",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream,
}, {
  "name": "Total failed orders",
  "query": "eapi_method:SubmitOrder AND (NOT \"Order is submitted successfully.\") AND (NOT eapi_direction:Started)",
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream,
}, {
  "name": "Total successful mobile payments",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogEAPINumberView, 
  "stream": config.graylogEapiStream
}, {
  "name": "Total failed mobile payments",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream
}, {
  "name": "Total success BJS online payments",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream,
}, {
  "name": "Total failed BJS online payments",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogEAPINumberView,
  "stream": config.graylogEapiStream,
}, {
  "name": `Total "Succesful Paypal but Failed SubmitOrder"`,
  "query": `userflow_action:ERR_SUBMIT_ORDER_ORDER_TIME_SHOPPING_CART_PREVIEW_PAGE AND message:"\\"paymentOption\\":\\"PAYMENT_BY_PAYPAL\\""`,
  "view": config.graylogUserFlowNumberView,
  "stream": config.graylogUserFlowStream
}, {
  "name": `Total orders submitted with paypal (APPROVE_PAYPAL_PAYMENT`,
  "query": "userflow_action:(COMPLETE_PAYPAL_PAYMENT OR APPROVE_PAYPAL_PAYMENT)",
  "view": config.graylogUserFlowNumberView,
  "stream": config.graylogUserFlowStream
}, {
  "name": `Total failure mobile paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP/ERR_PAYPAL_PAYMENT_VALIDATION_MP/ERR_PAYPAL_PAYMENT_EAPI_MP)`,
  "query": "userflow_action:(ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP OR ERR_PAYPAL_PAYMENT_VALIDATION_MP OR ERR_PAYPAL_PAYMENT_EAPI_MP)",
  "view": config.graylogUserFlowNumberView,
  "stream": config.graylogUserFlowStream
}, {
  "name": `Total failure BJS online paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD/ERR_PAYPAL_PAYMENT_VALIDATION/ERR_PAYPAL_PAYMENT_EAPI)`,
  "query": "userflow_action:(ERR_PAYPAL_PAYMENT_PAGE_LOAD OR ERR_PAYPAL_PAYMENT_VALIDATION OR ERR_PAYPAL_PAYMENT_VALIDATION OR ERR_PAYPAL_PAYMENT_EAPI)",
  "view": config.graylogUserFlowNumberView,
  "stream": config.graylogUserFlowStream
}, {
    "name": `Total open check`,
    "query": "userflow_action:ON_LOAD_OPEN_CHECK_MP",
    "view": config.graylogUserFlowNumberView,
    "stream": config.graylogUserFlowStream
}]

export default queries;
