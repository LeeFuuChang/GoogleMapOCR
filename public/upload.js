document.getElementById("uploadForm").onsubmit = async function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const response = await fetch("/upload", {
        method: "POST",
        body: formData,
    });
    const result = await response.json();
    document.getElementById("response").textContent = JSON.stringify(
        result.detection
    );
};
