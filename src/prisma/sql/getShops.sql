WITH shop_with_distance AS (
    SELECT
        s.*,
        sqrt(
            ((s."addressLatitude" - $1) * $2) ^ 2 + ((s."addressLongitude" - $3) * $4) ^ 2
        ) AS distance
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
        $5::float8 IS NULL
        OR swd.distance <= $5
    )
    AND (
        swd.distance <= swd."maximumDistance"
    )
    AND (
        $6::text[] Is NULL
        OR cardinality($6) = 0
        OR swd.name ILIKE ANY($6)
    )
    AND (
        $7::uuid[] IS NULL
        OR cardinality($7) = 0
        OR EXISTS (
            SELECT
                1
            FROM
                "_ShopToShopCategory" AS sj2
            WHERE
                sj2."A" = swd.id
                AND sj2."B" = ANY($7)
        )
    )
    AND (
        $8::int IS NULL
        OR swd.rating >= $8
    )
    AND (
        $9::int IS NULL
        OR (
            swd."openTimeStart" <= swd."openTimeEnd"
            AND $9 BETWEEN swd."openTimeStart"
            AND swd."openTimeEnd"
        )
        OR (
            swd."openTimeStart" > swd."openTimeEnd"
            AND (
                $9 >= swd."openTimeStart"
                OR $9 <= swd."openTimeEnd"
            )
        )
    )
ORDER BY
    CASE
        WHEN $10 = 'r' THEN swd.rating
    END DESC,
    CASE
        WHEN $10 = 't' THEN swd.distance
    END ASC,
    CASE
        WHEN $10 = 'c' THEN swd.rating * EXP(-0.06 * swd.distance)
    END DESC
LIMIT
    $11 OFFSET $12;