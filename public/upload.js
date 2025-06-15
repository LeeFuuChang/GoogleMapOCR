document.querySelector("form").onsubmit = async function (e) {
    e.preventDefault();

    if(document.querySelector("input[type='file']")) {
        const formData = new FormData(this);
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });
        const result = await response.json();

        document.querySelector("h1").innerText = "Modify Detection Result";
        document.querySelector("button").innerText = "Submit";
        [...document.querySelectorAll("input")].map(inp=>inp.remove());

        let html = result.detection.map(res=>`<input type="text" value="${res.name}" data-is-road="${res.isRoad}">`).join("");
        document.querySelector("form").innerHTML = html + document.querySelector("form").innerHTML;
    }
    else {
        let final = [...document.querySelectorAll("input[type='text']")].map(inp=>({
            name: inp.value,
            isRoad: inp.getAttribute("data-is-road") == "true",
        }));
        final = final.filter((item)=>(item.name.length != 0));
        document.body.innerHTML = `<div id="map"></div>`;
        initMap();
        markAndConnect(final);
    }
}