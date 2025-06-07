-- 获取推荐商品列表，包含搜索、筛选、距离、店铺状态等约束
-- @param {Float} $11:minPrice?
-- @param {Float} $12:maxPrice?
WITH item_with_distance AS (
    SELECT
        i.*,
        s."addressLatitude" AS shop_latitude,
        s."addressLongitude" AS shop_longitude,
        ((point(s."addressLongitude", s."addressLatitude") <@> point($2, $1)) * 1.609344) AS distance,
        s."verified" AS shop_verified,
        s."opened" AS shop_opened,
        s."openTimeStart" AS shop_open_time_start,
        s."openTimeEnd" AS shop_open_time_end,
        s."maximumDistance" AS shop_maximum_distance,
        s."rating" AS shop_rating
    FROM
        "Item" AS i
        JOIN "Shop" AS s ON i."shopId" = s."id"
)
SELECT
    iwd.*,
    COALESCE(
        (
            SELECT json_agg(json_build_object('id', ic.id, 'name', ic.name))
            FROM "_ItemToItemCategory" AS ij
            JOIN "ItemCategory" AS ic ON ic.id = ij."B"
            WHERE ij."A" = iwd.id
        ),
        '[]'::json
    ) AS categories
FROM
    item_with_distance AS iwd
WHERE
    (iwd.shop_verified = true)
    AND (iwd.shop_opened = true)
    AND (iwd.distance <= iwd.shop_maximum_distance)
    AND ($3::float8 IS NULL OR iwd.distance <= $3)
    AND ($4::text[] IS NULL OR cardinality($4) = 0 OR iwd.name ILIKE ANY($4))
    AND ($5::uuid[] IS NULL OR cardinality($5) = 0 OR EXISTS (
        SELECT 1 FROM "_ItemToItemCategory" ij2 WHERE ij2."A" = iwd.id AND ij2."B" = ANY($5)
    ))
    AND (iwd.rating >= $6)
    AND (($7::int IS NULL) OR (
        (iwd.shop_open_time_start <= $7 AND iwd.shop_open_time_end > $7)
        OR (iwd.shop_open_time_start > iwd.shop_open_time_end AND ($7 >= iwd.shop_open_time_start OR $7 < iwd.shop_open_time_end))
    ))
    AND ($11::float8 IS NULL OR iwd.price >= $11)
    AND ($12::float8 IS NULL OR iwd.price <= $12)
ORDER BY
    CASE WHEN $8 = 'r' THEN iwd.rating END DESC,
    CASE WHEN $8 = 't' THEN iwd.distance END ASC,
    CASE WHEN $8 = 'c' THEN iwd.rating * EXP(-0.06 * iwd.distance) END DESC,
    CASE WHEN $8 = 's' THEN iwd.sale END DESC,
    iwd.id
LIMIT $9 OFFSET $10;
