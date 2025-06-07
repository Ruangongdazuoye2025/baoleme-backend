WITH shop_with_distance AS (
    SELECT
        s.*,
        ((point(s."addressLongitude", s."addressLatitude") <@> point($2, $1)) * 1609.344) / 1000 AS distance
    FROM
        "Shop" AS s
)
SELECT
    swd.*,
    COALESCE(
        (
            SELECT
                json_agg(
                    json_build_object(
                        'id',
                        sc_inner.id,
                        'name',
                        sc_inner.name,
                        "order",
                        sc_inner."order"
                    )
                )
            FROM
                "_ShopToShopCategory" AS sj_inner
                JOIN "ShopCategory" AS sc_inner ON sc_inner.id = sj_inner."B"
            WHERE
                sj_inner."A" = swd.id
        ),
        '[]' :: json
    ) AS categories
FROM
    shop_with_distance AS swd
WHERE
    (
        $3::float8 IS NULL
        OR swd.distance <= $3
    )
    AND (
        swd.distance <= swd."maximumDistance"
    )
    AND (
        swd."verified" = true
    )
    AND (
        swd."opened" = true
    )
    AND (
        $4::text[] Is NULL
        OR cardinality($4) = 0
        OR swd.name ILIKE ANY($4)
    )
    AND (
        $5::uuid[] IS NULL
        OR cardinality($5) = 0
        OR EXISTS (
            SELECT
                1
            FROM
                "_ShopToShopCategory" AS sj2
            WHERE
                sj2."A" = swd.id
                AND sj2."B" = ANY($5)
        )
    )
    AND (
        $6::int IS NULL
        OR swd.rating >= $6
    )
    AND (
        $7::int IS NULL
        OR (
            swd."openTimeStart" <= swd."openTimeEnd"
            AND $7 BETWEEN swd."openTimeStart"
            AND swd."openTimeEnd"
        )
        OR (
            swd."openTimeStart" > swd."openTimeEnd"
            AND (
                $7 >= swd."openTimeStart"
                OR $7 <= swd."openTimeEnd"
            )
        )
    )
ORDER BY
    CASE
        WHEN $8 = 'r' THEN swd.rating
    END DESC,
    CASE
        WHEN $8 = 't' THEN swd.distance
    END ASC,
    CASE
        WHEN $8 = 'c' THEN swd.rating * EXP(-0.06 * swd.distance)
    END DESC
LIMIT
    $9 OFFSET $10;