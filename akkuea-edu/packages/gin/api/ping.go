package api

import (
	"net/http"

	"gin/common"
	"gin/models"
	"gin/services"

	"github.com/gin-gonic/gin"
)

func PingHandler(c *gin.Context) {
	response := models.PingResponse{Message: services.GetPingMessage()}
	common.JSONSuccess(c, http.StatusOK, response, "Ping successful")
}
