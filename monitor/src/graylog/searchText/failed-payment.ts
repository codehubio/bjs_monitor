import { config } from "../../config";

const queries= [{
  "name": "Failure ProcessPaymentP3",
  "query": 'eapi_direction:Ended AND (eapi_method:(ProcessPaymentP3 OR ApplePayCloseCheckP3 OR PayPalVerifyCloseCheckP4 OR ProcessPayPalFuturePaymentP4) AND NOT ("Thank you for your payment" OR "Payment processed successfully")) AND ("Credit Card is declined, please correct your payment information and try again." OR "Payment cannot be processed at this time. Please try again later." OR "We apologize, there is an error processing your payment. Please correct your payment information and try again." OR "We apologize, it looks like we are experiencing difficulties with your payment methods. Please contact restaurant for help.")',
  "view": config.graylogPaymentSearchView
}];
export const GROUP_BY_COLUMN_1 = 'eapi_method';
export const GROUP_BY_COLUMN_2 = 'eapi_err_desc';
export const GROUP_BY_COLUMN_3 = 'eapi_result_msg';

export default queries;

// , {
//   "name": "Failure ProcessPaymentP4",
//   "query": 'eapi_direction:Started AND (eapi_method:(ProcessPaymentP3 OR ApplePayCloseCheckP3 OR PayPalVerifyCloseCheckP4 OR ProcessPayPalFuturePaymentP4))'
// }