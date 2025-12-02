DROP TABLE IF EXISTS order_data;
CREATE TABLE order_data as SELECT * FROM read_json_auto('./*.json');