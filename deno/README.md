# Local Publishing Server (Deno)

**Note:** The main web application is now configured to use a hosted version of this server (`https://bunnhack-rwstudio-51.deno.dev/`). Running this locally is only necessary for development or if the hosted server is unavailable.

This Deno server acts as a local proxy to publish your creations from the web editor to Roblox. It is required to bypass browser security (CORS) and to securely handle your Roblox API key.

## How to Run

1.  **Install Deno:** 
    If you don't have Deno installed, follow the official installation instructions at [https://deno.land/](https://deno.land/).

2.  **Start the Server:** 
    Open your terminal, navigate to this `deno` directory, and run the following command:

    ```sh
    deno run --allow-net main.js
    ```

    The server will start and listen for requests on `http://localhost:8000`. Keep this terminal window open while you are using the "Publish to Roblox" feature in the web editor.

## What it Does

-   **Listens for requests** from the web editor on `http://localhost:8000/publish`.
-   **Receives** your scene data (`rbxlx`), API key, and IDs.
-   **Forwards the request** to the official Roblox Open Cloud API with the correct headers and authentication.
-   **Sends the response** from Roblox back to the web editor.

This process ensures your `x-api-key` is never exposed in the browser's client-side code.