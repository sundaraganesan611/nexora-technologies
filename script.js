
console.log("NEXORA SCRIPT LOADED");

// MOBILE NAVIGATION
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.textContent = isOpen ? "✕" : "☰";
});

// CLOSE MENU AFTER CLICKING A LINK
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

// AUTOMATIC COPYRIGHT YEAR
document.getElementById("year").textContent =
    new Date().getFullYear();

// CONTACT FORM
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
    }

    const submitButton = contactForm.querySelector(
        'button[type="submit"]'
    );

    // GET TURNSTILE TOKEN
    const turnstileToken =
        contactForm.querySelector(
            '[name="cf-turnstile-response"]'
        )?.value;

    if (!turnstileToken) {
        formMessage.textContent =
            "Please complete the security verification.";
        return;
    }

    const enquiry = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        service: document.getElementById("service").value,
        message: document.getElementById("message").value.trim(),
        turnstile_token: turnstileToken
    };

    if (
        enquiry.name.length < 2 ||
        enquiry.name.length > 100 ||
        enquiry.email.length > 254 ||
        enquiry.message.length < 5 ||
        enquiry.message.length > 5000
    ) {
        formMessage.textContent =
            "Please check your details.";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
        const response = await fetch("/api/submit-enquiry", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(enquiry)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Submission failed.");
        }

        formMessage.textContent =
            "Thank you! Your enquiry was submitted successfully.";

        contactForm.reset();

        if (window.turnstile) {
            window.turnstile.reset();
        }

    } catch (error) {
        console.error("Enquiry submission failed:", error);

        formMessage.textContent =
            error.message || "Unable to submit your enquiry.";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send Enquiry ↗";
    }
});

// CLOSE MENU WHEN CLICKING OUTSIDE
document.addEventListener("click", function(event) {
    const clickedInsideMenu = navLinks.contains(event.target);
    const clickedToggle = menuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    }
});
