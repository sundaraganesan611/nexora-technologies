
console.log("NEXORA SCRIPT LOADED");

import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";

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

// SUPABASE CONFIGURATION
const SUPABASE_URL = window.NEXORA_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.NEXORA_CONFIG.SUPABASE_KEY;

// CONTACT FORM
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
const honeypotField = document.getElementById("website");

contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
    }

    // HONEYPOT PROTECTION
    if (honeypotField && honeypotField.value.trim() !== "") {
        formMessage.textContent =
            "Unable to submit your enquiry. Please try again.";
        return;
    }

    const submitButton = contactForm.querySelector(
        'button[type="submit"]'
    );

    const enquiry = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        service: document.getElementById("service").value,
        message: document.getElementById("message").value.trim()
    };

    // CLIENT-SIDE VALIDATION
    if (
        enquiry.name.length < 2 ||
        enquiry.name.length > 100 ||
        enquiry.email.length > 254 ||
        enquiry.message.length < 5 ||
        enquiry.message.length > 5000
    ) {
        formMessage.textContent = "Please check your details.";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    formMessage.textContent = "";

    try {
        // SEND ENQUIRY THROUGH EDGE FUNCTION
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/submit-enquiry`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_KEY
                },
                body: JSON.stringify(enquiry)
            }
        );

        const result = await response.json();

        if (response.status === 429) {
            throw new Error(
                "Too many enquiries. Please try again later."
            );
        }

        if (!response.ok) {
            throw new Error(
                result.error || "Unable to submit your enquiry."
            );
        }

        formMessage.textContent =
            "Thank you! Your enquiry was submitted successfully.";

        contactForm.reset();

    } catch (error) {
        console.error("Enquiry submission failed:", error);

        formMessage.textContent =
            error.message || "Unable to submit your enquiry. Please try again.";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send Enquiry ↗";
    }
});

// CLOSE MOBILE MENU WHEN CLICKING OUTSIDE
document.addEventListener("click", function(event) {
    const clickedInsideMenu = navLinks.contains(event.target);
    const clickedToggle = menuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    }
});
