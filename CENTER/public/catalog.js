export const BRAND = "TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST";
export const ROLES = {
  admin: "Quản trị hệ thống",
  coordinator: "Điều phối trung tâm",
  researcher: "Thành viên nghiên cứu",
  reviewer: "Người phản biện",
  finance: "Phụ trách kinh phí",
};
export const STATUS = {
  draft: "Bản nháp",
  submitted: "Chờ tiếp nhận",
  reviewing: "Đang phản biện",
  revision: "Cần chỉnh sửa",
  approved: "Được phê duyệt",
  active: "Đang thực hiện",
  acceptance: "Chờ nghiệm thu",
  completed: "Đã nghiệm thu",
  published: "Đã công bố",
  rejected: "Không được duyệt",
  archived: "Lưu trữ",
};
// [key, label, input type, required, select choices]
export const CATALOG = {
  ideas: {
    label: "Ý tưởng & sáng kiến",
    icon: "✦",
    intro: "Bắt đầu từ một vấn đề đáng giải quyết.",
    fields: [
      [
        "field",
        "Lĩnh vực",
        "select",
        true,
        ["Giáo dục", "Cộng đồng", "Công nghệ", "Môi trường", "Khác"],
      ],
      ["problem", "Vấn đề cần giải quyết", "textarea", true],
      ["solution", "Giải pháp đề xuất", "textarea", true],
      ["impact", "Tác động dự kiến", "textarea"],
    ],
  },
  projects: {
    label: "Đề tài & dự án",
    icon: "◈",
    intro: "Tổ chức nghiên cứu từ đề cương đến ứng dụng.",
    fields: [
      ["type", "Loại hình", "select", true, ["Nghiên cứu", "Đổi mới sáng tạo"]],
      ["field", "Lĩnh vực", "text", true],
      ["objectives", "Mục tiêu", "textarea", true],
      ["method", "Phương pháp", "textarea", true],
      ["outputs", "Sản phẩm dự kiến", "textarea", true],
      ["start", "Ngày bắt đầu", "date"],
      ["due", "Hạn hoàn thành", "date", true],
      [
        "human_subjects",
        "Có người tham gia khảo sát/thử nghiệm",
        "select",
        true,
        ["Không", "Có"],
      ],
      ["consent", "Kế hoạch đồng thuận và bảo vệ dữ liệu", "textarea"],
      [
        "ethics",
        "Đánh giá điều kiện triển khai (điều phối xác nhận)",
        "textarea",
      ],
    ],
  },
  teams: {
    label: "Nhóm nghiên cứu",
    icon: "◎",
    intro: "Kết nối chuyên môn và phối hợp thực hiện.",
    fields: [
      ["focus", "Hướng nghiên cứu", "textarea", true],
      ["contact", "Đầu mối liên hệ", "text"],
      ["meeting", "Lịch sinh hoạt", "text"],
    ],
  },
  tasks: {
    label: "Công việc & tiến độ",
    icon: "☑",
    intro: "Mỗi nhiệm vụ có người phụ trách và hạn hoàn thành.",
    project: true,
    fields: [
      ["assignee", "Người phụ trách", "user", true],
      ["due", "Hạn hoàn thành", "date", true],
      [
        "priority",
        "Mức ưu tiên",
        "select",
        true,
        ["Bình thường", "Cao", "Khẩn"],
      ],
      ["progress", "Tiến độ (%)", "number", true],
      ["deliverable", "Sản phẩm bàn giao", "textarea"],
    ],
  },
  journals: {
    label: "Nhật ký nghiên cứu",
    icon: "▤",
    intro: "Ghi lại phương pháp, quan sát và những điều học được.",
    project: true,
    fields: [
      ["date", "Ngày ghi nhận", "date", true],
      ["method", "Cách thực hiện", "textarea", true],
      ["result", "Kết quả quan sát", "textarea", true],
      ["next", "Bước tiếp theo", "textarea"],
    ],
  },
  documents: {
    label: "Kho tài liệu",
    icon: "▧",
    intro: "Lưu tài liệu có nguồn gốc và phiên bản rõ ràng.",
    project: true,
    fields: [
      [
        "category",
        "Loại tài liệu",
        "select",
        true,
        ["Đề cương", "Báo cáo", "Biên bản", "Tham khảo", "Khác"],
      ],
      ["source", "Nguồn / tác giả", "text", true],
      ["edition", "Phiên bản tài liệu", "text"],
      ["license", "Quyền sử dụng", "text"],
    ],
  },
  datasets: {
    label: "Dataset",
    icon: "▦",
    intro: "Mô tả dữ liệu để người khác hiểu và tái sử dụng đúng cách.",
    project: true,
    fields: [
      ["source", "Nguồn thu thập", "textarea", true],
      ["dictionary", "Mô tả các trường dữ liệu", "textarea", true],
      ["license", "Giấy phép / điều kiện sử dụng", "text", true],
      [
        "personal",
        "Dữ liệu cá nhân",
        "select",
        true,
        ["Không", "Đã ẩn danh", "Có dữ liệu cá nhân"],
      ],
      ["consent", "Cơ sở đồng thuận / phạm vi sử dụng", "textarea"],
      ["edition", "Phiên bản", "text", true],
    ],
  },
  councils: {
    label: "Hội đồng",
    icon: "◇",
    intro: "Tổ chức phiên đánh giá và lưu kết luận.",
    project: true,
    restricted: true,
    fields: [
      ["chair", "Chủ trì", "user", true],
      ["members", "Danh sách thành viên / vai trò", "textarea", true],
      ["date", "Ngày họp", "date", true],
      ["minutes", "Biên bản và ý kiến", "textarea"],
      ["conclusion", "Kết luận", "textarea"],
    ],
  },
  acceptances: {
    label: "Nghiệm thu",
    icon: "✓",
    intro: "Đối chiếu kết quả với mục tiêu và sản phẩm cam kết.",
    project: true,
    fields: [
      ["outputs", "Sản phẩm thực tế", "textarea", true],
      ["evidence", "Minh chứng / đối chiếu chỉ tiêu", "textarea", true],
      ["limitations", "Hạn chế và hướng tiếp tục", "textarea"],
      ["council", "Mã hồ sơ hội đồng", "text", true],
      ["decision", "Kết luận nghiệm thu (điều phối xác nhận)", "textarea"],
    ],
  },
  publications: {
    label: "Công bố",
    icon: "↗",
    intro: "Chia sẻ kết quả được duyệt với cộng đồng.",
    project: true,
    fields: [
      ["authors", "Tác giả và đóng góp", "textarea", true],
      ["abstract", "Tóm tắt nghiên cứu", "textarea", true],
      ["content", "Nội dung công bố", "textarea", true],
      ["references", "Tài liệu tham khảo", "textarea"],
      ["license", "Điều kiện sử dụng", "text", true],
      ["doi", "DOI đã được cấp (nếu có)", "text"],
    ],
  },
  budgets: {
    label: "Kinh phí",
    icon: "₫",
    intro: "Theo dõi dự toán, đề nghị và chứng từ thực chi.",
    project: true,
    fields: [
      [
        "type",
        "Loại khoản",
        "select",
        true,
        ["Dự toán", "Đề nghị chi", "Thực chi"],
      ],
      ["amount", "Số tiền (VND)", "number", true],
      ["category", "Hạng mục", "text", true],
      ["payee", "Đơn vị / người nhận", "text"],
      ["date", "Ngày dự kiến / thực chi", "date", true],
      ["evidence", "Mô tả chứng từ", "textarea"],
    ],
  },
  events: {
    label: "Sự kiện & đào tạo",
    icon: "◷",
    intro: "Hội thảo, chuyên đề và các buổi trao đổi nghiên cứu.",
    fields: [
      ["start", "Bắt đầu (giờ Việt Nam)", "datetime-local", true],
      ["end", "Kết thúc (giờ Việt Nam)", "datetime-local", true],
      ["location", "Địa điểm / đường dẫn tham dự", "text", true],
      ["capacity", "Số chỗ tối đa", "number", true],
      ["agenda", "Chương trình", "textarea", true],
    ],
  },
  contributions: {
    label: "Ghi nhận đóng góp",
    icon: "☆",
    intro: "Ghi nhận minh bạch đóng góp trong từng đề tài.",
    project: true,
    fields: [
      ["recipient", "Thành viên được ghi nhận", "user", true],
      ["role", "Vai trò đóng góp", "text", true],
      ["evidence", "Minh chứng đóng góp", "textarea", true],
      ["hours", "Số giờ đóng góp", "number"],
    ],
  },
  impacts: {
    label: "Ứng dụng & tác động",
    icon: "⌁",
    intro: "Theo dõi kết quả sau nghiệm thu và công bố.",
    project: true,
    fields: [
      ["location", "Nơi ứng dụng", "text", true],
      ["indicator", "Chỉ số theo dõi", "text", true],
      ["baseline", "Mức ban đầu", "text"],
      ["result", "Kết quả đạt được", "textarea", true],
      ["date", "Ngày ghi nhận", "date", true],
      ["next", "Cải tiến tiếp theo", "textarea"],
    ],
  },
};
export const PUBLIC_KINDS = [
  "publications",
  "events",
  "projects",
  "datasets",
  "contributions",
  "profiles",
  "teams",
  "impacts",
  "ideas",
];
export const STAGES = [
  "draft",
  "submitted",
  "reviewing",
  "approved",
  "active",
  "acceptance",
  "completed",
  "published",
];
Object.assign(CATALOG, {
  profiles: {
    label: "Nhà nghiên cứu",
    icon: "♧",
    intro: "Hồ sơ chuyên môn và đóng góp.",
    fields: [
      ["position", "Chức danh", "text"],
      ["bio", "Giới thiệu", "textarea", true],
      ["interests", "Hướng nghiên cứu", "textarea"],
      ["skills", "Kỹ năng", "text"],
      ["orcid", "ORCID (nếu có)", "text"],
    ],
  },
  milestones: {
    label: "Milestone",
    icon: "⚑",
    project: true,
    fields: [
      ["due", "Hạn hoàn thành", "date", true],
      ["deliverable", "Sản phẩm", "textarea", true],
      ["progress", "Tiến độ (%)", "number", true],
    ],
  },
  ethics: {
    label: "Đạo đức nghiên cứu",
    icon: "◉",
    project: true,
    fields: [
      ["participants", "Đối tượng tham gia", "textarea", true],
      ["minors", "Có người chưa thành niên", "select", true, ["Không", "Có"]],
      ["consent", "Quy trình đồng thuận", "textarea", true],
      ["risk", "Rủi ro và biện pháp giảm thiểu", "textarea", true],
      ["privacy", "Bảo vệ thông tin cá nhân", "textarea", true],
      ["retention", "Thời hạn lưu và cách hủy dữ liệu", "textarea", true],
      ["expires", "Hiệu lực đến", "date", true],
    ],
  },
  forms: {
    label: "Biểu mẫu",
    icon: "▣",
    fields: [
      ["purpose", "Mục đích thu thập", "textarea", true],
      ["privacy", "Thông báo sử dụng dữ liệu", "textarea", true],
    ],
  },
  partners: {
    label: "Đối tác",
    icon: "⊕",
    restricted: true,
    fields: [
      ["contact", "Đầu mối", "text", true],
      ["email", "Email", "email"],
      ["field", "Lĩnh vực hợp tác", "text"],
      ["notes", "Ghi chú nội bộ", "textarea"],
    ],
  },
  collaborations: {
    label: "Đề xuất hợp tác",
    icon: "⇄",
    fields: [
      ["organization", "Tổ chức / cá nhân", "text", true],
      ["email", "Email liên hệ", "email", true],
      ["proposal", "Đề xuất", "textarea", true],
      ["resources", "Nguồn lực dự kiến", "textarea"],
    ],
  },
  news: {
    label: "Tin tức & báo cáo",
    icon: "▱",
    fields: [
      [
        "type",
        "Loại",
        "select",
        true,
        ["Tin tức", "Báo cáo", "Cơ hội tham gia", "Thông báo"],
      ],
      ["content", "Nội dung", "textarea", true],
      ["date", "Ngày đăng", "date", true],
      ["tags", "Từ khóa", "text"],
    ],
  },
  pages: {
    label: "Nội dung website",
    icon: "▥",
    restricted: true,
    fields: [
      ["slug", "Đường dẫn (ví dụ about)", "text", true],
      ["content", "Nội dung", "textarea", true],
    ],
  },
  challenges: {
    label: "Innovation Challenge",
    icon: "⚡",
    fields: [
      ["theme", "Chủ đề", "text", true],
      ["criteria", "Tiêu chí", "textarea", true],
      ["due", "Hạn tiếp nhận", "date", true],
      ["benefits", "Hỗ trợ / ghi nhận", "textarea"],
    ],
  },
});
PUBLIC_KINDS.push(
  "ideas",
  "teams",
  "profiles",
  "documents",
  "news",
  "pages",
  "challenges",
);
export const JOURNEY = [
  "Ý tưởng",
  "Xác định vấn đề",
  "Tổng quan tài liệu",
  "Câu hỏi nghiên cứu",
  "Giả thuyết",
  "Thiết kế nghiên cứu",
  "Thu thập dữ liệu",
  "Phân tích",
  "Viết báo cáo",
  "Phản biện",
  "Chỉnh sửa",
  "Nghiệm thu",
  "Công bố",
  "Đánh giá tác động",
  "Lưu trữ",
];
export const ACTIONS = {
  submit: "Gửi xét duyệt",
  screen: "Tiếp nhận sơ bộ",
  review: "Chuyển phản biện",
  revise: "Yêu cầu chỉnh sửa",
  approve: "Phê duyệt",
  reject: "Từ chối",
  start: "Bắt đầu thực hiện",
  acceptance: "Đề nghị nghiệm thu",
  complete: "Xác nhận hoàn thành",
  publish: "Công bố",
  archive: "Lưu trữ",
  reopen: "Mở lại bản nháp",
};
STATUS.screening = "Sơ tuyển";
CATALOG.projects.fields.push(
  ["questions", "Câu hỏi nghiên cứu", "textarea"],
  ["hypothesis", "Giả thuyết", "textarea"],
  ["scope", "Phạm vi", "textarea"],
  ["keywords", "Từ khóa", "text"],
  ["group", "Mã nhóm nghiên cứu", "text"],
);
CATALOG.tasks.fields.push(
  ["parent", "Mã nhiệm vụ cha", "text"],
  ["checklist", "Checklist (mỗi dòng một việc)", "textarea"],
);
CATALOG.ideas.fields.push(
  [
    "phase",
    "Giai đoạn sáng kiến",
    "select",
    true,
    [
      "Idea",
      "Evaluation",
      "Selected",
      "Prototype",
      "Testing",
      "Improvement",
      "Deployment",
      "Impact",
    ],
  ],
  ["kpi", "KPI và kết quả thử nghiệm", "textarea"],
);
CATALOG.budgets.fields[0][4].push("Khoản thu");
CATALOG.documents.fields[0][4].push(
  "Research Report",
  "Working Paper",
  "Research Brief",
  "Policy Brief",
  "Presentation",
  "Poster",
  "Infographic",
  "Methodology",
  "Template",
);
CATALOG.datasets.fields.push(
  ["collection", "Phương pháp thu thập", "textarea"],
  ["date", "Ngày dữ liệu", "date"],
);
CATALOG.journals.fields.push(
  [
    "activity",
    "Loại hoạt động",
    "select",
    false,
    ["Tổng quan", "Thu thập", "Phân tích", "Thử nghiệm", "Họp nhóm", "Khác"],
  ],
  ["issues", "Khó khăn / vấn đề", "textarea"],
);
CATALOG.publications.fields.push(
  [
    "type",
    "Loại công bố",
    "select",
    false,
    [
      "Research Report",
      "Working Paper",
      "Research Brief",
      "Policy Brief",
      "Other",
    ],
  ],
  ["keywords", "Từ khóa", "text"],
  ["date", "Ngày công bố", "date"],
  ["edition", "Phiên bản", "text"],
);
CATALOG.events.fields.push(
  [
    "type",
    "Loại sự kiện",
    "select",
    false,
    [
      "Seminar",
      "Workshop",
      "Conference",
      "Training",
      "Research meeting",
      "Innovation challenge",
    ],
  ],
  ["report", "Báo cáo sau sự kiện", "textarea"],
);
CATALOG.budgets.fields.push(["source", "Nguồn kinh phí", "text"]);
CATALOG.contributions.fields.push([
  "type",
  "Loại đóng góp",
  "select",
  false,
  ["Research", "Publication", "Volunteer / Support", "Event"],
]);
CATALOG.councils.fields.push([
  "scores",
  "Điểm và nhận xét của từng thành viên",
  "textarea",
]);
CATALOG.acceptances.fields.push([
  "outcome",
  "Kết quả đề nghị",
  "select",
  false,
  ["Accepted", "Conditional Acceptance", "Revision", "Rejected"],
]);
CATALOG.collaborations.fields.push([
  "stage",
  "Giai đoạn xử lý",
  "select",
  false,
  ["Tiếp nhận", "Trao đổi", "Đề xuất", "Thống nhất", "Triển khai", "Kết thúc"],
]);
STATUS.expired = "Hết hiệu lực";
