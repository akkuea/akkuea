package models

import "gorm.io/gorm"

type Resource struct {
    gorm.Model
    Title     string `json:"title" gorm:"not null;size:200"`
    Content   string `json:"content" gorm:"type:text"`
    // Optional classification fields for discovery
    Theme     string `json:"theme" gorm:"size:100"` // e.g., math, science, history
    Level     string `json:"level" gorm:"size:50"`  // e.g., beginner, intermediate, advanced
    Language  string `json:"language" gorm:"size:10"`
    Format    string `json:"format" gorm:"size:50"` // pdf, video, audio, text, etc.
    CreatorID uint   `json:"creator_id" gorm:"not null;index"`
    // Curation status of the resource: Approved, Pending, or Rejected
    Status string `json:"status" gorm:"not null;size:20;default:Pending;check:status IN ('Approved','Pending','Rejected')"`

	// Foreign key relationship
	Creator User `json:"creator" gorm:"foreignKey:CreatorID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

// TableName specifies the table name for Resource model
func (Resource) TableName() string {
	return "resources"
}
