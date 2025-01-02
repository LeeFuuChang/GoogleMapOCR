let map;
let service;
let display;

function initMap() {
    service = new google.maps.DirectionsService();
    display = new google.maps.DirectionsRenderer();
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 25.033964, lng: 121.564468 },
        zoom: 16,
        mapId: "DEMO_MAP_ID",
    });
    display.setMap(map);
    findPlaces();
}

async function findPlaces() {
    const { Place } = await google.maps.importLibrary("places");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const request = {
        textQuery: "捷運",
        fields: ["displayName", "location"],
        language: "zh-TW",
        region: "tw",
        maxResultCount: 8,
    };

    const { places } = await Place.searchByText(request);

    if (places.length) {
        service.route(
            {
                origin: places[0].location,
                destination: places[places.length - 1].location,
                waypoints: places.slice(1).map((p) => ({
                    location: p.location,
                    stopover: true,
                })),
                optimizeWaypoints: true,
                travelMode: "WALKING",
            },
            function (response, status) {
                if (status === "OK") {
                    console.log(response);
                    display.setDirections(response);
                } else {
                    window.alert("Directions request failed due to " + status);
                }
            }
        );

        const { LatLngBounds } = await google.maps.importLibrary("core");
        const bounds = new LatLngBounds();

        places.forEach((place) => {
            const markerView = new AdvancedMarkerElement({
                map,
                position: place.location,
                title: place.displayName,
            });

            bounds.extend(place.location);
        });
        map.fitBounds(bounds);
    } else {
        console.log("No results");
    }
}
