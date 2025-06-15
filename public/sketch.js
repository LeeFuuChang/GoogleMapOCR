let map;
let service;
let display;

async function initMap() {
    service = new google.maps.DirectionsService();
    display = new google.maps.DirectionsRenderer();
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 25.033964, lng: 121.564468 },
        zoom: 16,
        mapId: "map",
    });
    display.setMap(map);
}

async function markAndConnect(extracted) {
    console.log(extracted);

    const { Place } = await google.maps.importLibrary("places");

    let results = [];

    let prevRoad = null;
    for(let i = 0; i < extracted.length; i++) {
        let searching = null;
        if(extracted[i].isRoad) {
            if(!prevRoad) {
                prevRoad = extracted[i].name;
                continue;
            }
            else if(extracted[i].name != prevRoad) {
                searching = `${extracted[i].name} & ${prevRoad}`;
                prevRoad = extracted[i].name;
            }
        }
        else {
            searching = extracted[i].name;
        }

        if(searching) {
            const request = {
                textQuery: searching,
                fields: ["displayName", "location"],
                language: "zh-TW",
                region: "tw",
                maxResultCount: 8,
            };

            const { places } = await Place.searchByText(request);
            console.log(searching, places);

            if(!places.length) continue;

            results.push({ name: searching, result: places.map(p=>p.location) });
        }
    }

    console.log(results);

    let minDistance = Infinity;
    let minDistanceAvg = Infinity;
    let minDistanceRoute = null;
    let runningIndexes = results.map((res)=>[0, res.result.length]);
    while(true) {
        let distance = 0;
        for(let i = 1; i < results.length; i++) {
            distance += getDistanceBetweenLatLng(
                results[i].result[ runningIndexes[i][0] ].lat(),
                results[i].result[ runningIndexes[i][0] ].lng(),
                results[i - 1].result[ runningIndexes[i - 1][0] ].lat(),
                results[i - 1].result[ runningIndexes[i - 1][0] ].lng(),
            );
        }
        if(distance < minDistance) {
            minDistance = distance;
            minDistanceAvg = distance / results.length;
            minDistanceRoute = runningIndexes.map((pair, index) => {
                return {
                    name: results[index].name,
                    location: results[index].result[ pair[0] ],
                };
            });
        }

        let i = 0;
        while(i < runningIndexes.length && runningIndexes[i][0] == runningIndexes[i][1] - 1) i++;
        if(i == runningIndexes.length) break;
        runningIndexes[i][0] += 1
        for(let j = 0; j < i; j++) runningIndexes[j][0] = 0;
    }

    console.log("最短路線長", minDistance);
    console.log("平均節點距離", minDistanceAvg);

    for(let i = 1; i < minDistanceRoute.length - 1; i++) {
        let prevDistance = getDistanceBetweenLatLng(
            minDistanceRoute[i].location.lat(),
            minDistanceRoute[i].location.lng(),
            minDistanceRoute[i - 1].location.lat(),
            minDistanceRoute[i - 1].location.lng(),
        );
        let nextDistance = getDistanceBetweenLatLng(
            minDistanceRoute[i].location.lat(),
            minDistanceRoute[i].location.lng(),
            minDistanceRoute[i + 1].location.lat(),
            minDistanceRoute[i + 1].location.lng(),
        );
        if(prevDistance > minDistanceAvg*2 && nextDistance > minDistanceAvg*2) {
            console.log("因距離異常而刪除", minDistanceRoute[i], [prevDistance, nextDistance]);
            minDistanceRoute.splice(i, 1);
            i -= 1;
        }
    }

    for(let i = 1; i < minDistanceRoute.length; i++) {
        console.log(`${minDistanceRoute[i-1].name} ~ ${minDistanceRoute[i].name}: ${getDistanceBetweenLatLng(
            minDistanceRoute[i - 1].location.lat(),
            minDistanceRoute[i - 1].location.lng(),
            minDistanceRoute[i].location.lat(),
            minDistanceRoute[i].location.lng(),
        )}`);
    }

    service.route({
        origin: minDistanceRoute[0].location,
        destination: minDistanceRoute[0].location,
        travelMode: "WALKING",
        optimizeWaypoints: true,
        waypoints: minDistanceRoute.slice(1).map((spot)=>({
            location: spot.location,
            stopover: true,
        })),
    }, function(response, status){
        if(status == "OK") {
            console.log(response);
            display.setDirections(response);
        }
    });

    const { LatLngBounds } = await google.maps.importLibrary("core");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const bounds = new LatLngBounds();

    minDistanceRoute.forEach((spot)=>{
        new AdvancedMarkerElement({
            map, position: spot.location,
        });
        bounds.extend(spot.location);
    });
    map.fitBounds(bounds);
}

function getDistanceBetweenLatLng(lat1, lng1, lat2, lng2) {
    return (
        1.609344 * 60 * 1.1515 * (180/Math.PI) * Math.acos(
            (Math.sin(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)))
            +
            (Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lng1-lng2) * (Math.PI / 180)))
        )
    );
}