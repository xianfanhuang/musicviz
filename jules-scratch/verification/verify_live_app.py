from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        device_scale_factor=2,
    )
    page = context.new_page()
    page.goto("https://xianfanhuang.github.io/musicviz/")
    # Wait for the page to be fully loaded
    page.wait_for_load_state('networkidle')
    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
