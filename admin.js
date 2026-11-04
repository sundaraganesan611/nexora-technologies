
// Nexora Technologies - Admin Dashboard
// Uses the existing config.js and Supabase publishable key.

const db = window.supabase.createClient(
    window.NEXORA_CONFIG.SUPABASE_URL,
    window.NEXORA_CONFIG.SUPABASE_KEY
);

const ADMIN_EMAIL = "sundars1046@gmail.com".toLowerCase();

const $ = (id) => document.getElementById(id);

const loginSection = $("loginSection");
const dashboardSection = $("dashboardSection");
const loginMessage = $("loginMessage");
const dashboardMessage = $("dashboardMessage");
const enquiryTable = $("enquiryTable");

let allEnquiries = [];
let visibleEnquiries = [];

// MESSAGE HELPER
function setMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#ff8585" : "#54d6ff";
}

// BUTTON LOADING HELPER
function setBusy(button, busy, busyText, normalText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
}

// ADMIN LOGIN
$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = $("loginButton");
    const email = $("adminEmail").value.trim().toLowerCase();
    const password = $("adminPassword").value;

    setBusy(button, true, "Signing in...", "Login to Dashboard");
    setMessage(loginMessage, "Verifying your account...");

    try {
        const { error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await checkAdmin();

    } catch (error) {
        console.error("Admin login failed:", error);
        setMessage(
            loginMessage,
            "Login failed. Check your email and password.",
            true
        );
    } finally {
        setBusy(button, false, "Signing in...", "Login to Dashboard");
    }
});

// VERIFY ADMIN SESSION
async function checkAdmin() {
    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (!session) {
            loginSection.classList.remove("admin-hidden");
            dashboardSection.classList.add("admin-hidden");
            return;
        }

        const signedInEmail =
            (session.user.email || "").toLowerCase();

        if (signedInEmail !== ADMIN_EMAIL) {
            await db.auth.signOut();

            loginSection.classList.remove("admin-hidden");
            dashboardSection.classList.add("admin-hidden");

            setMessage(
                loginMessage,
                "Access denied: unauthorized admin account.",
                true
            );

            return;
        }

        loginSection.classList.add("admin-hidden");
        dashboardSection.classList.remove("admin-hidden");

        await loadEnquiries();

    } catch (error) {
        console.error("Session verification failed:", error);

        loginSection.classList.remove("admin-hidden");
        dashboardSection.classList.add("admin-hidden");

        setMessage(
            loginMessage,
            "Unable to verify your session. Please sign in again.",
            true
        );
    }
}

// LOAD CUSTOMER ENQUIRIES
async function loadEnquiries() {
    const refreshButton = $("refreshButton");

    refreshButton.disabled = true;

    setMessage(dashboardMessage, "Loading enquiries...");

    try {
        const { data, error } = await db
            .from("enquiries")
            .select("id, name, email, service, message, status, created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allEnquiries = data || [];

        updateStats();
        populateServiceFilter();
        applyFilters();

        setMessage(
            dashboardMessage,
            `${allEnquiries.length} enquiries loaded successfully.`
        );

    } catch (error) {
        console.error("Loading enquiries failed:", error);

        setMessage(
            dashboardMessage,
            "Unable to load enquiries. Check your connection and RLS policies.",
            true
        );

    } finally {
        refreshButton.disabled = false;
    }
}

// UPDATE DASHBOARD STATISTICS
function updateStats() {
    $("totalCount").textContent = allEnquiries.length;

    $("newCount").textContent =
        allEnquiries.filter(item => item.status === "New").length;

    $("progressCount").textContent =
        allEnquiries.filter(item => item.status === "In Progress").length;

    $("completedCount").textContent =
        allEnquiries.filter(item => item.status === "Completed").length;
}

// POPULATE SERVICE FILTER
function populateServiceFilter() {
    const select = $("serviceFilter");
    const currentValue = select.value;

    const services = [
        ...new Set(
            allEnquiries
                .map(item => item.service)
                .filter(Boolean)
        )
    ].sort();

    select.replaceChildren(
        new Option("All services", "")
    );

    services.forEach(service => {
        select.add(new Option(service, service));
    });

    if (services.includes(currentValue)) {
        select.value = currentValue;
    }
}

// SEARCH AND FILTER ENQUIRIES
function applyFilters() {
    const search = $("searchInput").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const service = $("serviceFilter").value;

    visibleEnquiries = allEnquiries.filter(item => {

        const searchable = [
            item.name,
            item.email,
            item.service,
            item.message,
            String(item.id)
        ].join(" ").toLowerCase();

        return (
            (!search || searchable.includes(search)) &&
            (!status || item.status === status) &&
            (!service || item.service === service)
        );
    });

    renderEnquiries();

    $("resultCount").textContent =
        `Showing ${visibleEnquiries.length} of ${allEnquiries.length} enquiries`;
}

// CREATE TABLE CELL SAFELY
function addCell(row, value) {
    const cell = document.createElement("td");

    cell.textContent = value ?? "";

    row.appendChild(cell);

    return cell;
}

// DISPLAY ENQUIRIES
function renderEnquiries() {
    enquiryTable.replaceChildren();

    if (visibleEnquiries.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "empty-state";

        cell.textContent = allEnquiries.length
            ? "No enquiries match your search or filters."
            : "No enquiries received yet.";

        row.appendChild(cell);
        enquiryTable.appendChild(row);

        return;
    }

    visibleEnquiries.forEach(item => {

        const row = document.createElement("tr");

        // ID
        addCell(row, `#${item.id}`);

        // CUSTOMER
        const customerCell = document.createElement("td");

        const name = document.createElement("span");
        name.className = "customer-name";
        name.textContent = item.name;

        const email = document.createElement("span");
        email.className = "customer-email";
        email.textContent = item.email;

        customerCell.append(name, email);
        row.appendChild(customerCell);

        // SERVICE
        addCell(row, item.service);

        // DATE
        addCell(
            row,
            new Date(item.created_at).toLocaleString()
        );

        // STATUS DROPDOWN
        const statusCell = document.createElement("td");

        const statusSelect = document.createElement("select");

        statusSelect.setAttribute(
            "aria-label",
            `Change status for enquiry ${item.id}`
        );

        ["New", "In Progress", "Completed", "Rejected"]
            .forEach(status => {

                const option = new Option(status, status);

                option.selected = item.status === status;

                statusSelect.add(option);
            });

        statusSelect.addEventListener("change", () => {
            updateStatus(item.id, statusSelect.value, statusSelect);
        });

        statusCell.appendChild(statusSelect);
        row.appendChild(statusCell);

        // VIEW BUTTON
        const actionCell = document.createElement("td");

        const viewButton = document.createElement("button");

        viewButton.type = "button";
        viewButton.className = "admin-action secondary";
        viewButton.textContent = "View";

        viewButton.addEventListener("click", () => {
            showEnquiryDetails(item);
        });

        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);

        enquiryTable.appendChild(row);
    });
}

// VIEW FULL CUSTOMER DETAILS
function showEnquiryDetails(item) {
    $("detailTitle").textContent = `Enquiry #${item.id}`;

    $("detailName").textContent = item.name || "—";
    $("detailEmail").textContent = item.email || "—";
    $("detailService").textContent = item.service || "—";

    $("detailDate").textContent = item.created_at
        ? new Date(item.created_at).toLocaleString()
        : "—";

    $("detailMessage").textContent =
        item.message || "No project details provided.";

    const dialog = $("enquiryDialog");

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        alert(
            `Customer: ${item.name}\n` +
            `Email: ${item.email}\n` +
            `Service: ${item.service}\n` +
            `Message: ${item.message}`
        );
    }
}

// UPDATE CUSTOMER ENQUIRY STATUS
async function updateStatus(id, status, selectElement) {
    selectElement.disabled = true;

    setMessage(
        dashboardMessage,
        `Updating enquiry #${id}...`
    );

    try {
        const { error } = await db
            .from("enquiries")
            .update({ status })
            .eq("id", id);

        if (error) throw error;

        const item = allEnquiries.find(
            enquiry => enquiry.id === id
        );

        if (item) {
            item.status = status;
        }

        updateStats();
        applyFilters();

        setMessage(
            dashboardMessage,
            `Enquiry #${id} status updated to ${status}.`
        );

    } catch (error) {
        console.error("Status update failed:", error);

        setMessage(
            dashboardMessage,
            "Status update failed. Check your admin permissions.",
            true
        );

        await loadEnquiries();

    } finally {
        selectElement.disabled = false;
    }
}

// EXPORT ENQUIRIES TO CSV
function exportCSV() {
    if (visibleEnquiries.length === 0) {
        setMessage(
            dashboardMessage,
            "There are no enquiries to export.",
            true
        );

        return;
    }

    const headers = [
        "ID",
        "Name",
        "Email",
        "Service",
        "Message",
        "Status",
        "Created At"
    ];

    const rows = visibleEnquiries.map(item => [
        item.id,
        item.name,
        item.email,
        item.service,
        item.message,
        item.status,
        item.created_at
    ]);

    const escapeCSV = value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
        `nexora-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage(
        dashboardMessage,
        `${visibleEnquiries.length} enquiries exported to CSV.`
    );
}

// REFRESH BUTTON
$("refreshButton").addEventListener(
    "click",
    loadEnquiries
);

// SEARCH INPUT
$("searchInput").addEventListener(
    "input",
    applyFilters
);

// STATUS FILTER
$("statusFilter").addEventListener(
    "change",
    applyFilters
);

// SERVICE FILTER
$("serviceFilter").addEventListener(
    "change",
    applyFilters
);

// CLEAR FILTERS
$("clearFiltersButton").addEventListener("click", () => {

    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("serviceFilter").value = "";

    applyFilters();
});

// EXPORT BUTTON
$("exportButton").addEventListener(
    "click",
    exportCSV
);

// CLOSE ENQUIRY DETAILS
function closeDetailsDialog() {
    const dialog = $("enquiryDialog");

    if (dialog.open) {
        dialog.close();
    }
}

$("closeDialogButton").addEventListener(
    "click",
    closeDetailsDialog
);

$("closeDialogTop").addEventListener(
    "click",
    closeDetailsDialog
);

$("enquiryDialog").addEventListener("click", event => {

    if (event.target === $("enquiryDialog")) {
        closeDetailsDialog();
    }
});

// ADMIN LOGOUT
$("logoutButton").addEventListener("click", async () => {

    $("logoutButton").disabled = true;

    try {
        const { error } = await db.auth.signOut();

        if (error) throw error;

        allEnquiries = [];
        visibleEnquiries = [];

        loginSection.classList.remove("admin-hidden");
        dashboardSection.classList.add("admin-hidden");

        $("loginForm").reset();

        setMessage(
            loginMessage,
            "You have been logged out."
        );

    } catch (error) {
        console.error("Logout failed:", error);

        setMessage(
            dashboardMessage,
            "Logout failed. Please try again.",
            true
        );

    } finally {
        $("logoutButton").disabled = false;
    }
});


 // HANDLE LOGOUT FROM ANOTHER TAB
db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        allEnquiries = [];
        visibleEnquiries = [];

        enquiryTable.replaceChildren();

        loginSection.classList.remove("admin-hidden");
        dashboardSection.classList.add("admin-hidden");

        $("loginForm").reset();
    }
});

// RESTORE EXISTING SESSION
checkAdmin();
