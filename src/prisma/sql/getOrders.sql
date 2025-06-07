-- 获取推荐订单列表，包含距离、收入等筛选和排序
-- @param {Float} $1:lat 骑手纬度
-- @param {Float} $2:lon 骑手经度
-- @param {Float} $3:maxDistance? 最大配送距离（公里）
-- @param {Int}   $4:minIncome? 最小订单收入（分）
-- @param {Int}   $5:limit 分页大小
-- @param {Int}   $6:offset 分页起点
WITH order_with_distance AS (
    SELECT
        o.*,
        s."name" AS shop_name,
        s."addressLatitude" AS shop_lat,
        s."addressLongitude" AS shop_lon,
        s."addressAddress" AS shop_address,
        s."deliveryPrice" AS delivery_price,
        -- 骑手到店距离
        ((point(s."addressLongitude", s."addressLatitude") <@> point($2, $1)) * 1.609344) AS dist_rider_to_shop_km,
        -- 店到顾客距离
        ((point(o."customerLongitude", o."customerLatitude") <@> point(s."addressLongitude", s."addressLatitude")) * 1.609344) AS dist_shop_to_customer_km
    FROM
        "Order" o
        JOIN "Shop" s ON o."shopId" = s."id"
    WHERE
        o."status" = 'PREPARED'
        AND o."riderId" IS NULL
)
SELECT
    owd.*,
    (owd.dist_rider_to_shop_km + owd.dist_shop_to_customer_km) AS total_distance_km,
    owd.delivery_price AS income,
    CASE WHEN (owd.dist_rider_to_shop_km + owd.dist_shop_to_customer_km) > 0 THEN owd.delivery_price / (owd.dist_rider_to_shop_km + owd.dist_shop_to_customer_km) ELSE 0 END AS score
FROM
    order_with_distance owd
WHERE
    ($3::float8 IS NULL OR (owd.dist_rider_to_shop_km + owd.dist_shop_to_customer_km) <= $3)
    AND ($4::int IS NULL OR owd.delivery_price >= $4)
ORDER BY
    score DESC, owd.id
LIMIT $5 OFFSET $6;
