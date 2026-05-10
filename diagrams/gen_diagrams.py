import json, random, os

random.seed(42)

def uid():
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=16))

BASE = {
    "angle": 0, "strokeWidth": 2, "strokeStyle": "solid", "roughness": 0,
    "opacity": 100, "groupIds": [], "frameId": None, "seed": 0,
    "version": 1, "versionNonce": 0, "isDeleted": False,
    "boundElements": [], "updated": 1714000000000, "link": None, "locked": False
}

def mk(**kw):
    d = dict(BASE)
    d["seed"] = random.randint(1, 999999)
    d["versionNonce"] = random.randint(1, 999999)
    d.update(kw)
    return d

def box(x, y, w, h, label="", fill="#dbeafe", stroke="#1e40af", text_size=14, bold=False, radius=True):
    rid = uid()
    elems = [mk(
        id=rid, type="rectangle", x=x, y=y, width=w, height=h,
        strokeColor=stroke, backgroundColor=fill, fillStyle="solid",
        roundness={"type": 3} if radius else None
    )]
    if label:
        tid = uid()
        lines = label.split("\n")
        lh = text_size * 1.35
        total_h = lh * len(lines)
        elems.append(mk(
            id=tid, type="text",
            x=x, y=y + (h - total_h) / 2,
            width=w, height=total_h,
            strokeColor="#1e1e2e", backgroundColor="transparent", fillStyle="solid",
            strokeWidth=1, text=label, fontSize=text_size,
            fontFamily=2, textAlign="center", verticalAlign="middle",
            containerId=rid, originalText=label, lineHeight=1.35,
            roundness=None
        ))
        elems[0]["boundElements"] = [{"type": "text", "id": tid}]
    return elems, rid

def diamond(x, y, w, h, label="", fill="#fef9c3", stroke="#854d0e", text_size=13):
    rid = uid()
    elems = [mk(
        id=rid, type="diamond", x=x, y=y, width=w, height=h,
        strokeColor=stroke, backgroundColor=fill, fillStyle="solid",
        roundness=None
    )]
    if label:
        tid = uid()
        lh = text_size * 1.35
        lines = label.split("\n")
        total_h = lh * len(lines)
        elems.append(mk(
            id=tid, type="text",
            x=x, y=y + (h - total_h) / 2,
            width=w, height=total_h,
            strokeColor="#1e1e2e", backgroundColor="transparent", fillStyle="solid",
            strokeWidth=1, text=label, fontSize=text_size,
            fontFamily=2, textAlign="center", verticalAlign="middle",
            containerId=rid, originalText=label, lineHeight=1.35,
            roundness=None
        ))
        elems[0]["boundElements"] = [{"type": "text", "id": tid}]
    return elems, rid

def txt(x, y, text, size=13, color="#1e1e2e", align="left", bold=False):
    w = max(len(l) for l in text.split("\n")) * size * 0.58 + 10
    h = text.count("\n") * size * 1.35 + size * 1.35
    return [mk(
        id=uid(), type="text", x=x, y=y, width=w, height=h,
        strokeColor=color, backgroundColor="transparent", fillStyle="solid",
        strokeWidth=1, text=text, fontSize=size,
        fontFamily=2, textAlign=align, verticalAlign="top",
        containerId=None, originalText=text, lineHeight=1.35,
        roundness=None
    )]

def arr(x1, y1, x2, y2, color="#374151", dashed=False, label="", start_id=None, end_id=None):
    elems = [mk(
        id=uid(), type="arrow",
        x=x1, y=y1, width=abs(x2-x1), height=abs(y2-y1),
        strokeColor=color, backgroundColor="transparent", fillStyle="solid",
        strokeStyle="dashed" if dashed else "solid",
        points=[[0, 0], [x2-x1, y2-y1]],
        lastCommittedPoint=None,
        startBinding={"elementId": start_id, "focus": 0, "gap": 6} if start_id else None,
        endBinding={"elementId": end_id, "focus": 0, "gap": 6} if end_id else None,
        startArrowhead=None, endArrowhead="arrow",
        roundness={"type": 2}
    )]
    if label:
        mx = x1 + (x2-x1)/2 - 20
        my = y1 + (y2-y1)/2 - 10
        elems += txt(mx, my, label, size=11, color="#6b7280")
    return elems

def save(name, all_elems):
    doc = {
        "type": "excalidraw", "version": 2,
        "source": "https://excalidraw.com",
        "elements": all_elems,
        "appState": {"gridSize": None, "viewBackgroundColor": "#f8fafc"},
        "files": {}
    }
    path = os.path.join(os.path.dirname(__file__), f"{name}.excalidraw")
    with open(path, "w") as f:
        json.dump(doc, f, indent=2)
    print(f"  ✓ {name}.excalidraw")

# ─────────────────────────────────────────
# DIAGRAM 1: Architecture Layers
# ─────────────────────────────────────────
def diag1():
    els = []

    # Title
    els += txt(180, 20, "AgentHub — Four-Layer Architecture", size=20, color="#1e40af")

    colors = [
        ("#dbeafe", "#1e40af", "BROWSER LAYER\nReact Canvas  ·  Chat  ·  Analytics  ·  API Key Mgmt"),
        ("#dcfce7", "#166534", "API LAYER\nNext.js Routes  ·  Auth Middleware  ·  Rate Limiting"),
        ("#fef3c7", "#92400e", "EXECUTION LAYER\nDAG Executor  ·  LLM Abstraction  ·  Tools  ·  Memory  ·  Guardrails"),
        ("#fce7f3", "#9d174d", "PERSISTENCE LAYER\nPostgreSQL  ·  Row-Level Security  ·  Run Traces  ·  Checkpoints"),
    ]

    y = 70
    ids = []
    for fill, stroke, label in colors:
        elems, rid = box(100, y, 600, 80, label, fill=fill, stroke=stroke, text_size=14)
        els += elems
        ids.append((rid, y + 80))
        y += 80 + 20

    # Arrows between layers
    labels = ["HTTP / SSE", "Internal function calls", "SQL + RLS"]
    for i in range(3):
        _, bot_y = ids[i]
        _, top_y = ids[i+1]
        mid_y = bot_y
        ex = arr(390, mid_y, 390, top_y - 20, label=labels[i])
        els += ex

    save("diagram1_architecture", els)

# ─────────────────────────────────────────
# DIAGRAM 2: DAG Executor + Topological Sort
# ─────────────────────────────────────────
def diag2():
    els = []
    els += txt(130, 15, "DAG Executor — Topological Sort & Loop Detection", size=20, color="#1e40af")

    # Left: raw graph with cycle
    els += txt(60, 55, "Step 1: Raw graph (has cycle)", size=13, color="#374151")

    node_fill = "#dbeafe"; node_stroke = "#1e40af"
    lx = 60
    nodes_left = {}
    for name, x, y in [("Input",lx+80,100),("A",lx+30,180),("B",lx+130,180),("Loop\nBody",lx+80,260),("Output",lx+80,340)]:
        e, rid = box(x, y, 90, 50, name, fill=node_fill, stroke=node_stroke, text_size=12)
        els += e
        nodes_left[name] = (x+45, y+25, rid)

    def cx(name): return nodes_left[name][0]
    def cy(name): return nodes_left[name][1]

    els += arr(cx("Input"),cy("Input")+25,cx("A"),cy("A")-25)
    els += arr(cx("Input"),cy("Input")+25,cx("B"),cy("B")-25)
    els += arr(cx("A"),cy("A")+25,cx("Loop\nBody"),cy("Loop\nBody")-25)
    els += arr(cx("B"),cy("B")+25,cx("Loop\nBody"),cy("Loop\nBody")-25)
    els += arr(cx("Loop\nBody"),cy("Loop\nBody")+25,cx("Output"),cy("Output")-25)
    # back-edge (dashed red)
    els += arr(cx("Output")+5,cy("Output"),cx("A")+5,cy("A")+25, color="#ef4444", dashed=True, label="back-edge")

    # Middle: after stripping back-edge
    els += txt(330, 55, "Step 2: Strip back-edge → valid DAG", size=13, color="#374151")
    mx = 330
    nodes_mid = {}
    for name, x, y in [("Input",mx+80,100),("A",mx+30,180),("B",mx+130,180),("Loop\nBody",mx+80,260),("Output",mx+80,340)]:
        e, rid = box(x, y, 90, 50, name, fill=node_fill, stroke=node_stroke, text_size=12)
        els += e
        nodes_mid[name] = (x+45, y+25, rid)

    def mx2(name): return nodes_mid[name][0]
    def my2(name): return nodes_mid[name][1]
    els += arr(mx2("Input"),my2("Input")+25,mx2("A"),my2("A")-25)
    els += arr(mx2("Input"),my2("Input")+25,mx2("B"),my2("B")-25)
    els += arr(mx2("A"),my2("A")+25,mx2("Loop\nBody"),my2("Loop\nBody")-25)
    els += arr(mx2("B"),my2("B")+25,mx2("Loop\nBody"),my2("Loop\nBody")-25)
    els += arr(mx2("Loop\nBody"),my2("Loop\nBody")+25,mx2("Output"),my2("Output")-25)
    # stored back-edge note
    e2, _ = box(mx+10, 400, 160, 36, "back-edge stored in map", fill="#fef3c7", stroke="#92400e", text_size=11)
    els += e2
    els += arr(mx2("Output"), my2("Output")+25, mx+90, 400, color="#92400e", dashed=True)

    # Right: topological order
    els += txt(620, 55, "Step 3: Execute in topo order", size=13, color="#374151")
    order = ["Input", "A", "B", "Loop Body", "Output"]
    for i, name in enumerate(order):
        e, rid = box(630, 100 + i*65, 150, 45, f"{i+1}. {name}", fill="#dcfce7", stroke="#166534", text_size=13)
        els += e
        if i < len(order)-1:
            els += arr(705, 100+i*65+45, 705, 100+(i+1)*65)

    save("diagram2_dag_executor", els)

# ─────────────────────────────────────────
# DIAGRAM 3: 11 Node Types Gallery
# ─────────────────────────────────────────
def diag3():
    els = []
    els += txt(200, 15, "AgentHub — 11 Node Types", size=20, color="#1e40af")

    nodes = [
        ("INPUT",      "#bbf7d0", "#166534", "Receives API call payload\n& workflow entry point"),
        ("OUTPUT",     "#fecaca", "#991b1b", "Returns final result\nas API response"),
        ("LLM",        "#dbeafe", "#1e40af", "LLM call — Standard or\nAgentic (tool-calling loop)"),
        ("TOOL",       "#fef3c7", "#92400e", "Web Search, Scrape,\nHTTP, Code, Datatable, JS"),
        ("CONDITION",  "#fae8ff", "#6b21a8", "LLM-evaluated true/false\nrouting on plain English"),
        ("SWITCH",     "#fff7ed", "#c2410c", "N-way LLM classification\n(billing / tech / sales...)"),
        ("LOOP",       "#ecfdf5", "#065f46", "Repeat subgraph until\nexit condition or cap"),
        ("FORK",       "#f0f9ff", "#0369a1", "Split into N parallel\nbranches via Promise.all"),
        ("JOIN",       "#f0fdf4", "#15803d", "Merge parallel branches:\nconcat / object / array"),
        ("HITL",       "#fdf4ff", "#7e22ce", "Pause for human approval;\nresumes with notes injected"),
        ("CLARIFY",    "#fffbeb", "#b45309", "Ask user a question;\nresume with answer"),
    ]

    cols = 4
    W, H = 185, 80
    GAP_X, GAP_Y = 20, 18
    for i, (name, fill, stroke, desc) in enumerate(nodes):
        col = i % cols
        row = i // cols
        x = 40 + col * (W + GAP_X)
        y = 65 + row * (H + GAP_Y)
        e, _ = box(x, y, W, H, f"{name}\n{desc}", fill=fill, stroke=stroke, text_size=12)
        els += e

    save("diagram3_node_types", els)

# ─────────────────────────────────────────
# DIAGRAM 4: Fork/Join Timing
# ─────────────────────────────────────────
def diag4():
    els = []
    els += txt(130, 15, "Fork/Join — Parallel vs Sequential Execution", size=20, color="#1e40af")

    # Sequential (top)
    els += txt(40, 65, "Sequential  (5 branches × 800 ms = 4 000 ms total)", size=14, color="#991b1b")
    seq_labels = ["Security\n800ms","Pricing\n800ms","Reviews\n800ms","Reliability\n800ms","Compliance\n800ms"]
    x = 40
    for i, label in enumerate(seq_labels):
        e, _ = box(x, 90, 120, 55, label, fill="#fecaca", stroke="#991b1b", text_size=11)
        els += e
        if i < len(seq_labels)-1:
            els += arr(x+120, 117, x+140, 117)
        x += 140

    # Total sequential
    e, _ = box(40, 160, 740, 36, "Total: ~4 000 ms", fill="#fecaca", stroke="#991b1b", text_size=14)
    els += e

    # Parallel (bottom)
    els += txt(40, 230, "Fork / Join  (all 5 run simultaneously = ~900 ms total)", size=14, color="#166534")

    # Fork node
    e_fork, fork_id = box(340, 265, 100, 50, "FORK", fill="#dbeafe", stroke="#1e40af", text_size=14)
    els += e_fork

    branch_colors = ["#bbf7d0","#fef3c7","#dbeafe","#fae8ff","#fecaca"]
    branch_strokes = ["#166534","#92400e","#1e40af","#6b21a8","#991b1b"]
    branch_labels = ["Security","Pricing","Reviews","Reliability","Compliance"]
    branch_ids = []
    bx_positions = [40, 170, 300, 430, 560]
    for i, (bx, label, fill, stroke) in enumerate(zip(bx_positions, branch_labels, branch_colors, branch_strokes)):
        e, bid = box(bx, 360, 110, 48, f"{label}\n~800ms", fill=fill, stroke=stroke, text_size=11)
        els += e
        branch_ids.append((bx+55, bid))
        els += arr(390, 315, bx+55, 360)

    # Join node
    e_join, join_id = box(340, 440, 100, 50, "JOIN", fill="#dcfce7", stroke="#166534", text_size=14)
    els += e_join
    for bx_mid, _ in branch_ids:
        els += arr(bx_mid, 408, 390, 440)

    # Total parallel
    e, _ = box(260, 510, 260, 36, "Total: ~900 ms  (4.4× faster)", fill="#dcfce7", stroke="#166534", text_size=14)
    els += e

    save("diagram4_fork_join", els)

# ─────────────────────────────────────────
# DIAGRAM 5: HITL Checkpoint Flow
# ─────────────────────────────────────────
def diag5():
    els = []
    els += txt(120, 15, "HITL — Checkpoint-Based Pause & Resume", size=20, color="#1e40af")

    steps = [
        ("Execution\nRunning", "#dbeafe", "#1e40af"),
        ("HITL Node\nReached", "#fae8ff", "#6b21a8"),
        ("Snapshot\nSaved to DB\n(all prior outputs)", "#fef3c7", "#92400e"),
        ("Status:\nwaiting_hitl", "#fecaca", "#991b1b"),
        ("Human Reviews\n& Approves\nvia API", "#dcfce7", "#166534"),
        ("Checkpoint\nLoaded\nfrom DB", "#fef3c7", "#92400e"),
        ("Resume from\nHITL node\n(notes injected)", "#dbeafe", "#1e40af"),
    ]

    x = 30
    ids = []
    for label, fill, stroke in steps:
        e, rid = box(x, 120, 100, 80, label, fill=fill, stroke=stroke, text_size=11)
        els += e
        ids.append((x+50, rid))
        x += 120

    for i in range(len(ids)-1):
        x1 = ids[i][0]+50
        x2 = ids[i+1][0]-50
        els += arr(x1, 160, x2, 160)

    # Time gap annotation
    e2, _ = box(300, 230, 230, 36, "minutes  ·  hours  ·  days", fill="#fff7ed", stroke="#c2410c", text_size=13)
    els += e2
    els += arr(350, 160+40, 415, 230, color="#c2410c", dashed=True)

    # Key insight box
    e3, _ = box(30, 300, 800, 50,
        "Key insight: the executor doesn't pause — it completes. The checkpoint IS the pause. Server restarts are safe.",
        fill="#f0f9ff", stroke="#0369a1", text_size=13)
    els += e3

    save("diagram5_hitl", els)

# ─────────────────────────────────────────
# DIAGRAM 9: Vendor Due Diligence Agent Full Flow
# ─────────────────────────────────────────
def diag9():
    els = []
    els += txt(150, 10, "Vendor Due Diligence Agent — Full Workflow", size=20, color="#1e40af")

    cx_main = 420

    def bx(label, y, fill, stroke, w=180, h=52, x=None):
        rx = (x if x is not None else cx_main - w//2)
        e, rid = box(rx, y, w, h, label, fill=fill, stroke=stroke, text_size=12)
        return e, rid, rx+w//2, y, y+h

    def dn(label, y, fill="#fef9c3", stroke="#854d0e", w=180, h=60):
        rx = cx_main - w//2
        e, rid = diamond(rx, y, w, h, label, fill=fill, stroke=stroke, text_size=12)
        return e, rid, rx+w//2, y, y+h

    all_ids = []

    # Input
    e, r, mx, _, bot = bx("INPUT\n{ vendor_name, use_case }", 55, "#bbf7d0","#166534")
    els += e; all_ids.append((r, mx, bot))

    # Clarify
    e, r, mx, _, bot = bx("CLARIFY\n\"Biggest concern?\"", 135, "#fae8ff","#6b21a8")
    els += e; all_ids.append((r, mx, bot))
    els += arr(420, 107, 420, 135)

    # Fork
    e, r, fork_mx, _, fork_bot = bx("FORK\n5 branches (broadcast)", 215, "#dbeafe","#1e40af")
    els += e; all_ids.append((r, fork_mx, fork_bot))
    els += arr(420, 187, 420, 215)

    # 5 branches
    branch_info = [
        ("Security\nSearch + Extract", 80, "#bbf7d0","#166534"),
        ("Pricing\nSearch + Extract", 220, "#fef3c7","#92400e"),
        ("Reviews\nSentiment + LLM", 360, "#dbeafe","#1e40af"),
        ("Reliability\nSLAs + Outages", 500, "#fae8ff","#6b21a8"),
        ("Compliance\nCerts + GDPR", 640, "#fecaca","#991b1b"),
    ]

    branch_ids = []
    for label, bx_x, fill, stroke in branch_info:
        e, bid, bmx, _, bbot = bx(label, 310, fill, stroke, w=130, h=60, x=bx_x)
        els += e
        branch_ids.append((bid, bmx, bbot))
        els += arr(420, fork_bot, bmx, 310, color="#374151")

    # Join
    e, r, join_mx, _, join_bot = bx("JOIN\nconcatenate all 5", 430, "#dcfce7","#166534")
    els += e
    els += arr(420, 370, 420, 430)

    # Score
    e, r, score_mx, _, score_bot = bx("SCORE\nExtract 5 dim scores 0–10\n(temp=0)", 510, "#fef3c7","#92400e", h=64)
    els += e; els += arr(420, join_bot, 420, 510)

    # Condition
    e, r, cond_mx, _, cond_bot = dn("Critical Risk?\nany score < 4?", 600)
    els += e; els += arr(420, score_bot, 420, 600)

    # YES branch (left)
    e, r_risk, _, _, _ = bx("Format Risk\nSummary", 700, "#fecaca","#991b1b", w=150, x=200)
    els += e
    e, r_hitl1, _, _, _ = bx("HITL: Escalate\nHuman decides: proceed?", 775, "#fae8ff","#6b21a8", w=150, x=200)
    els += e
    els += arr(420, cond_bot, 275, 700, color="#ef4444", label="YES")
    els += arr(275, 752, 275, 775)

    # NO branch (right)
    e, r_loop, _, _, _ = bx("LOOP\nFill Research Gaps\n(max 2 iters)", 700, "#dcfce7","#166534", w=150, x=590)
    els += e
    els += arr(420, cond_bot, 665, 700, color="#166534", label="NO")

    # Draft report (converge)
    e, r_draft, draft_mx, _, draft_bot = bx("DRAFT Due\nDiligence Report\n(temp=0.3)", 880, "#dbeafe","#1e40af", h=64)
    els += e
    els += arr(275, 827, 420, 880, color="#374151")
    els += arr(665, 752, 420, 880, color="#374151")

    # HITL sign-off
    e, r_hitl2, _, _, _ = bx("HITL: Procurement\nSign-off + context", 972, "#fae8ff","#6b21a8")
    els += e; els += arr(420, draft_bot, 420, 972)

    # Finalize
    e, r_fin, _, _, _ = bx("FINALIZE\nIncorporate notes", 1052, "#dbeafe","#1e40af")
    els += e; els += arr(420, 1024, 420, 1052)

    # Output
    e, r_out, _, _, _ = bx("OUTPUT\nScorecard + Full Report", 1132, "#bbf7d0","#166534")
    els += e; els += arr(420, 1104, 420, 1132)

    save("diagram9_vendor_due_diligence", els)

print("Generating diagrams...")
diag1()
diag2()
diag3()
diag4()
diag5()
diag9()
print("Done. All .excalidraw files written to diagrams/")
