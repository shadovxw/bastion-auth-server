package services

import (
	"time"

	"gorm.io/gorm"
)

type AnalyticsService struct {
	db *gorm.DB
}

func NewAnalyticsService(db *gorm.DB) *AnalyticsService {
	return &AnalyticsService{db: db}
}

type Overview struct {
	TotalUsers       int64 `json:"totalUsers"`
	TotalRoles       int64 `json:"totalRoles"`
	TotalPermissions int64 `json:"totalPermissions"`
	TotalGroups      int64 `json:"totalGroups"`
	TotalApps        int64 `json:"totalApps"`
	NewUsersLast7d   int64 `json:"newUsersLast7d"`
	NewUsersLast30d  int64 `json:"newUsersLast30d"`
}

type LabelCount struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type DayCount struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

func (s *AnalyticsService) GetOverview() (*Overview, error) {
	var out Overview
	s.db.Raw("SELECT COUNT(*) FROM users").Scan(&out.TotalUsers)
	s.db.Raw("SELECT COUNT(*) FROM roles").Scan(&out.TotalRoles)
	s.db.Raw("SELECT COUNT(*) FROM permissions").Scan(&out.TotalPermissions)
	s.db.Raw(`SELECT COUNT(*) FROM "groups"`).Scan(&out.TotalGroups)
	s.db.Raw("SELECT COUNT(*) FROM apps").Scan(&out.TotalApps)
	cutoff7 := time.Now().UTC().AddDate(0, 0, -7)
	cutoff30 := time.Now().UTC().AddDate(0, 0, -30)
	s.db.Raw("SELECT COUNT(*) FROM users WHERE created_at >= ?", cutoff7).Scan(&out.NewUsersLast7d)
	s.db.Raw("SELECT COUNT(*) FROM users WHERE created_at >= ?", cutoff30).Scan(&out.NewUsersLast30d)
	return &out, nil
}

func (s *AnalyticsService) GetUsersByProvider() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT provider AS label, COUNT(*) AS count
		FROM users
		GROUP BY provider
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetUsersByRole() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT r.name AS label, COUNT(DISTINCT ur.user_id) AS count
		FROM roles r
		LEFT JOIN user_roles ur ON ur.role_id = r.id
		GROUP BY r.id, r.name
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetUsersByGroup() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT g.name AS label, COUNT(ug.user_id) AS count
		FROM "groups" g
		LEFT JOIN user_groups ug ON ug.group_id = g.id
		GROUP BY g.id, g.name
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetUsersByApp() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT COALESCE(a.name, 'Platform-wide') AS label, COUNT(DISTINCT ur.user_id) AS count
		FROM user_roles ur
		LEFT JOIN apps a ON a.id = ur.app_id
		GROUP BY ur.app_id, a.name
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetUserGrowth(days int) ([]DayCount, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	var rows []DayCount
	s.db.Raw(`
		SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
		       COUNT(*) AS count
		FROM users
		WHERE created_at >= ?
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY date ASC
	`, cutoff).Scan(&rows)
	if rows == nil {
		rows = []DayCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetRolesByPermissionCount() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT r.name AS label, COUNT(rp.permission_id) AS count
		FROM roles r
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		GROUP BY r.id, r.name
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}

func (s *AnalyticsService) GetPermissionsByRoleCount() ([]LabelCount, error) {
	var rows []LabelCount
	s.db.Raw(`
		SELECT p.name AS label, COUNT(rp.role_id) AS count
		FROM permissions p
		LEFT JOIN role_permissions rp ON rp.permission_id = p.id
		GROUP BY p.id, p.name
		ORDER BY count DESC
	`).Scan(&rows)
	if rows == nil {
		rows = []LabelCount{}
	}
	return rows, nil
}
